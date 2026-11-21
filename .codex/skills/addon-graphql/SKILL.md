---
name: addon-graphql
description: >
  Add-on GraphQL cho VIPER — lắp lên stack-nestjs-react / stack-nestjs-react-fullstack (Apollo/Mercurius code-first) hoặc
  stack-nextjs-fullstack (GraphQL Yoga). Nạp khi client cần query linh hoạt, nhiều client khác nhau lấy
  hình dạng dữ liệu khác nhau, hoặc đã có ràng buộc phải dùng GraphQL. Gồm: khi nào ĐỪNG dùng GraphQL trong
  bối cảnh 1 tuần, cách lắp vào từng stack, bẫy N+1, phân quyền theo field, giới hạn độ sâu query,
  và checklist production-ready riêng của GraphQL.
---

# Add-on — GraphQL

> Đây là **add-on**, không phải stack. Lắp lên `stack-nestjs-react`, `stack-nestjs-react-fullstack` hoặc `stack-nextjs-fullstack`.
> Ghi vào `context/TECHSTACK.md`: `Skill đang dùng: stack-nestjs-react + addon-graphql`.

## 1. Đọc phần này trước khi quyết

Với sản phẩm VIPER (một tuần, một người, một client), GraphQL thường **làm chậm ngày 1** mà chưa đổi lại được gì. Nó tính tiền trước, trả lãi sau.

**Đừng dùng khi**: chỉ có một web client · dữ liệu hình dạng đơn giản · chọn GraphQL vì thấy hay chứ không vì ràng buộc thật. Server action (Next.js) hoặc REST (NestJS) ra sản phẩm nhanh hơn.

**Dùng khi**: nhiều loại client cần hình dạng dữ liệu khác nhau (web + mobile + đối tác) · client phải gộp nhiều nguồn trong một lần gọi · ràng buộc từ bên ngoài bắt phải dùng.

Quyết định dùng GraphQL → ghi `DECISIONS.md` kèm ràng buộc thật đã khiến chọn nó.

## 2. Lắp vào NestJS

```bash
cd apps/api
npm i @nestjs/graphql @nestjs/apollo @apollo/server graphql
npm i dataloader
```

```ts
// app.module.ts — code-first: schema sinh từ TypeScript, không phải viết SDL rồi đồng bộ tay
GraphQLModule.forRoot<ApolloDriverConfig>({
  driver: ApolloDriver,
  autoSchemaFile: true,
  playground: process.env.NODE_ENV !== "production",
  introspection: process.env.NODE_ENV !== "production",  // tắt ở production
  context: ({ req }) => ({ req, loaders: createLoaders() }),
})
```

Cấu trúc: mỗi domain thêm `<d>.resolver.ts` cạnh `<d>.service.ts`. **Resolver mỏng như controller** — gọi service, không chạm DB.

## 3. Lắp vào Next.js

```bash
npm i graphql graphql-yoga dataloader
```

```ts
// src/app/api/graphql/route.ts
import { createYoga } from "graphql-yoga";
import { schema } from "@/server/graphql/schema";

const { handleRequest } = createYoga({
  schema,
  graphqlEndpoint: "/api/graphql",
  fetchAPI: { Response },
});
export { handleRequest as GET, handleRequest as POST };
```

Với Next.js, cân nhắc kỹ: server action đã cho phép client gọi thẳng hàm server có kiểu đầy đủ. GraphQL ở đây chỉ đáng khi có client khác ngoài chính web app này.

## 4. Bẫy N+1 — thứ giết hiệu năng GraphQL

Query lồng nhau khiến resolver con chạy một lần cho **mỗi** phần tử của danh sách cha. 20 booking → 21 truy vấn DB.

```graphql
query { bookings { id customer { name } } }   # customer resolver chạy 20 lần
```

Bắt buộc dùng DataLoader — gom lời gọi trong cùng một tick thành một truy vấn:

```ts
// loaders.ts
export const createLoaders = () => ({
  customerById: new DataLoader<string, Customer>(async (ids) => {
    const rows = await db.select().from(customers).where(inArray(customers.id, [...ids]));
    const map = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => map.get(id)!);   // PHẢI trả đúng thứ tự ids
  }),
});
```

```ts
@ResolveField()
customer(@Parent() booking: Booking, @Context() ctx) {
  return ctx.loaders.customerById.load(booking.customerId);
}
```

**Loader tạo mới mỗi request**, không dùng chung toàn cục — dùng chung là cache dữ liệu của người này trả cho người khác.

## 5. Phân quyền

GraphQL cho client tự chọn field, nên phân quyền ở tầng route không đủ.

| Mức | Cách làm |
|---|---|
| Toàn bộ query/mutation | Guard trên resolver (`@UseGuards(GqlAuthGuard)`) |
| Từng bản ghi | Service **luôn** truy vấn kèm `userId` — không bao giờ lấy chỉ bằng id |
| Từng field nhạy cảm | Field resolver tự kiểm quyền, hoặc directive `@auth` |

**Bẫy hay gặp**: `booking.customer.phone` — booking đúng là của người dùng, nhưng customer có thể của người khác nếu quan hệ không chặt. Kiểm ở resolver của field, không chỉ ở gốc.

## 6. Chống lạm dụng

Một endpoint GraphQL mở là một cách hay để bị vắt kiệt tài nguyên:

```ts
import depthLimit from "graphql-depth-limit";

validationRules: [depthLimit(7)]   // chặn query lồng vô hạn
```

- **Giới hạn độ sâu** — bắt buộc.
- **Tắt introspection và playground ở production** — đừng công bố toàn bộ schema.
- **Rate limit** theo IP/user như REST.
- **Persisted query** nếu chỉ client của mình gọi vào — chỉ chấp nhận query đã đăng ký trước.
- **Timeout** cho từng resolver chạm ra ngoài.

## 7. Forbidden patterns

| Cấm | Vì sao | Thay bằng |
|---|---|---|
| Resolver chạm DB trực tiếp | Không tái dùng được, không test được | Resolver → service |
| Resolver quan hệ không có DataLoader | N+1, sập dưới tải nhẹ | DataLoader theo request |
| DataLoader toàn cục | Rò dữ liệu giữa các người dùng | Tạo mới mỗi request |
| Bật introspection ở production | Công bố toàn bộ bề mặt tấn công | Tắt |
| Không giới hạn độ sâu | Một query đủ để làm sập | `depthLimit` |
| Viết SDL tay rồi tự đồng bộ với type | Chắc chắn lệch | Code-first, sinh schema |
| Trả lỗi nghiệp vụ dạng GraphQL error | Client khó phân biệt lỗi hệ thống với lỗi nghiệp vụ | Union/result type cho lỗi biết trước |

## 8. Checklist trước khi publish

Bổ sung cho `shared-production-ready`:

- [ ] Introspection + playground **tắt** ở production
- [ ] `depthLimit` đang bật
- [ ] Mọi resolver quan hệ đều đi qua DataLoader
- [ ] DataLoader tạo theo request, không toàn cục
- [ ] Mọi truy vấn có `userId`; field nhạy cảm kiểm quyền riêng
- [ ] Rate limit áp cho endpoint GraphQL
- [ ] Đã thử một query lồng sâu và một query lấy nhiều bản ghi — đếm số truy vấn DB thực tế

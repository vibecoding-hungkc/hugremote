---
name: stack-spring-boot
description: >
  Stack Java Spring Boot cho VIPER: Spring Web + Spring Data JPA + Flyway + Postgres, scaffold từ Spring
  Initializr, deploy Render/Railway bằng Docker. Chọn khi đội sẵn có Java, phải tích hợp hệ thống Java cũ,
  hoặc ràng buộc doanh nghiệp bắt dùng JVM. Nạp skill này khi TECHSTACK.md chốt stack-spring-boot, hoặc khi
  đang chọn stack ở pha V với ràng buộc Java. Gồm: scaffold, cấu trúc thư mục, 6 lệnh Makefile,
  preset production-ready, deploy, forbidden patterns, snippet then chốt.
---

# Stack — Java Spring Boot

## 1. Khi nào chọn / không chọn

**Chọn khi**: đội hoặc chính anh mạnh Java · phải tích hợp hệ thống Java sẵn có · ràng buộc doanh nghiệp bắt JVM.

**Không chọn khi**: mục tiêu là ra sản phẩm nhanh nhất và không có ràng buộc gì — Spring Boot là stack **chậm nhất** trong kho VIPER cho ngày 1 (khởi động lâu, nhiều khuôn mẫu, thời gian build dài).

**Nói thẳng**: chọn stack này nghĩa là đánh đổi tốc độ ngày 1 lấy sự quen tay hoặc ràng buộc tổ chức. Nếu không có ràng buộc đó, chọn stack khác. Nếu có, ghi rõ lý do vào `DECISIONS.md` — sáu tháng sau sẽ có người hỏi.

## 2. Scaffold

```bash
curl https://start.spring.io/starter.zip \
  -d dependencies=web,data-jpa,postgresql,flyway,validation,actuator,security \
  -d type=gradle-project -d language=java -d javaVersion=21 \
  -d groupId=<group> -d artifactId=<artifact> -d name=<name> \
  -o starter.zip && unzip starter.zip && rm starter.zip
```

Thêm vào `build.gradle`: `io.sentry:sentry-spring-boot-starter-jakarta`, `net.logstash.logback:logstash-logback-encoder` (log JSON), `org.springframework.boot:spring-boot-starter-test` (đã có sẵn).

**DB local cho `make dev`** — tạo `deployment/local/docker-compose.yml` (mọi artifact chạy local nằm ở đó, không rải ra gốc repo — xem `deployment/README.md`):

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_PASSWORD: postgres, POSTGRES_DB: app }
    ports: ["5432:5432"]
    volumes: ["dbdata:/var/lib/postgresql/data"]
volumes:
  dbdata:
```

Env local: `DATABASE_URL=jdbc:postgresql://localhost:5432/app?user=postgres&password=postgres` (application.yml đọc `${DATABASE_URL}`). Không có Docker → dùng Neon cho cả dev, ghi 1 dòng `DECISIONS.md`.

Ghi version thật vào `context/TECHSTACK.md §3`: `./gradlew dependencies --configuration runtimeClasspath | head -30`.

## 3. Cấu trúc thư mục

```
src/main/java/<pkg>/
├── Application.java
├── config/                    # SecurityConfig, CorsConfig, RateLimitConfig
├── <domain>/                  # gói theo DOMAIN, không theo tầng
│   ├── <D>Controller.java     # CHỈ nhận request, validate, gọi service
│   ├── <D>Service.java        # logic nghiệp vụ
│   ├── <D>Repository.java     # ← CHỈ chỗ này chạm DB
│   ├── <D>Entity.java         # JPA entity
│   └── dto/                   # request + response record, KHÔNG lộ entity
└── common/                    # exception handler, log, tiện ích

src/main/resources/
├── application.yml
└── db/migration/V1__init.sql  # Flyway — có version, commit vào repo
```

Gói theo domain (`booking/`, `customer/`) chứ **không** theo tầng (`controllers/`, `services/`) — sửa một tính năng chỉ mở một thư mục.

### Đường intake — đa target

Cấu trúc trên là của **đường phỏng vấn**: một app, scaffold thẳng vào gốc repo (luật #5).
Đường intake ([VIPER.md §1.3](../../../VIPER.md)) thì mỗi boundary/experience trong
`context/ARCHITECTURE.md §1–§3` là **một thư mục riêng** — cùng cấu trúc bên trên, nhưng
đặt bên trong thư mục target, dưới đúng nhóm của nó:

```
srcroot/boundaries/<tên>/          ← backend boundary   (ARCHITECTURE §1)
srcroot/web-experiences/<tên>/     ← frontend web       (ARCHITECTURE §2)
srcroot/mobile-experiences/<tên>/  ← frontend mobile    (ARCHITECTURE §3)
                                     cấu trúc §3 của skill này nằm BÊN TRONG mỗi thư mục đó

Makefile                           ← GỐC repo: hợp đồng 6 lệnh, điều phối
                                     `make -C srcroot/<nhóm>/<tên> …`
deployment/local/docker-compose.yml ← DB local dùng chung cho mọi target
deployment/.env.example            ← một danh sách biến cho cả hệ
```

Ba luật kèm theo: **không tự đẻ target** ngoài danh sách intake · **chỉ dựng target thuộc
phạm vi vòng này** (`intake/loops/l<N>/_PROPOSAL.md` cột Target) · **deploy luôn qua root
`make deploy`** (hook `guard_bc` canh ở đó). Quy ước đầy đủ: `srcroot/README.md`.

Và: **intake TECHSTACK thắng default của skill này** — scaffold theo đúng Choice trong
`context/TECHSTACK.md`, skill chỉ còn là tham khảo (preset §5, forbidden patterns §7).


## 4. Sáu lệnh Makefile

```makefile
STACK_SKILL = stack-spring-boot

dev:
	docker compose -f deployment/local/docker-compose.yml up -d db && ./gradlew bootRun

check:
	./gradlew build -x test

test:
	./gradlew test

migrate:
	./gradlew bootRun --args='--spring.main.web-application-type=none'

deploy:
	git push origin main

doctor:
	@test -n "$$DATABASE_URL" || { echo "✗ thiếu DATABASE_URL — xem deployment/.env.example"; exit 1; }
	@echo "✓ DATABASE_URL có"
	@curl -fs localhost:8080/actuator/health && echo "" \
	  || echo "· app chưa chạy ở local — bình thường nếu chỉ đang kiểm env trước khi deploy"
```

**`migrate` cố tình KHÔNG dùng `./gradlew flywayMigrate`**: task đó thuộc plugin Gradle `org.flywaydb.flyway`, mà dependency `flyway` của Spring Initializr chỉ kéo về `flyway-core` lúc chạy — gọi thẳng là `Task 'flywayMigrate' not found`. Cách trên khởi động app với web tắt: Flyway migrate xong thì context không có gì giữ lại nên tiến trình tự thoát. Không thêm plugin, không thêm cấu hình trùng lặp.

Flyway cũng tự chạy khi app khởi động bình thường (`spring.flyway.enabled=true`), nên `make dev` đã migrate — `make migrate` là để chạy riêng, ví dụ ở bước deploy.

**`doctor` phải fail thật khi thiếu env** — đó là việc chính của nó, và `/viper-publish` Bước 4 gọi nó ngay trước `make deploy` để bắt biến thiếu. Bản cũ `./gradlew -q doctor || echo ...` luôn exit 0 vì `echo` thành công: báo xanh mà không kiểm gì.

Ngược lại, phần health check **cố ý không fail**: lúc chuẩn bị deploy thì app local thường không chạy, bắt lỗi ở đó sẽ chặn nhầm. Thiếu env = đỏ; app local không chạy = chỉ ghi chú.

Thêm biến bắt buộc nào thì thêm một dòng `@test -n "$$TÊN_BIẾN" || ...` — giữ nguyên nguyên tắc: biến thiếu thì đỏ.

## 5. Preset production-ready

| Mục | Cách làm ở stack này |
|---|---|
| Env/secret | `application.yml` dùng `${DATABASE_URL}` không có giá trị mặc định → thiếu biến thì app **không khởi động** |
| Migration | Flyway, file `V<n>__<mô tả>.sql`. **Không bao giờ sửa file migration đã chạy** — checksum lệch là Flyway chặn khởi động |
| Health check | Actuator có sẵn: `/actuator/health` (bật `management.endpoint.health.show-details=when-authorized`) |
| Error tracking | `sentry-spring-boot-starter-jakarta` + `SENTRY_DSN` |
| Structured log | `logstash-logback-encoder` → log JSON; MDC gắn request id |
| Backup | Postgres của Render/Railway — bật snapshot, thử khôi phục một lần |
| Auth | Spring Security + JWT resource server, hoặc đặt sau provider ngoài. **Đừng tự viết filter chain từ đầu** |
| Validate | `jakarta.validation` annotation trên DTO + `@Valid` ở controller |
| Rate limit | Bucket4j, hoặc rate limit ở tầng PaaS/proxy |
| Phân quyền | Repository method **luôn** có tham số `userId`: `findByIdAndUserId(id, userId)` |
| JPA | `spring.jpa.hibernate.ddl-auto=validate` ở production — **không bao giờ** `update` hay `create` |
| N+1 | Bật `spring.jpa.properties.hibernate.generate_statistics` ở local để phát hiện sớm; dùng `@EntityGraph` khi cần |

## 6. Deploy

| Thành phần | Nơi | Ghi chú |
|---|---|---|
| App | Render hoặc Railway | Docker; JVM cần ≥512MB RAM, đừng chọn gói nhỏ nhất |
| Database | Postgres của Render/Railway, hoặc Neon | |

```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /src
COPY . .
RUN ./gradlew bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine
COPY --from=build /src/build/libs/*.jar /app.jar
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=75","-jar","/app.jar"]
```

`-XX:MaxRAMPercentage=75` là bắt buộc trên PaaS — không có nó JVM đọc nhầm RAM của cả máy chủ rồi bị OOM-kill.

Rollback: redeploy bản trước. Flyway **không** rollback tự động — schema đi theo luật cộng-trước-xoá-sau, không có đường lùi.

## 7. Forbidden patterns

| Cấm | Vì sao | Thay bằng |
|---|---|---|
| `ddl-auto: update` trên production | Hibernate tự đổi schema, sớm muộn mất dữ liệu | `validate` + Flyway |
| Sửa file migration đã chạy | Checksum lệch, app không khởi động được | Thêm file `V<n+1>__` mới |
| Trả entity ra response | Lộ field nội bộ, kéo theo lazy loading ngoài transaction | DTO record riêng |
| Controller gọi repository | Bỏ qua tầng logic, không test được | Controller → service → repository |
| `findById` không kèm userId | Lỗ hổng phân quyền | `findByIdAndUserId` |
| `@Transactional` trên controller | Transaction kéo dài suốt vòng đời request | Đặt ở service, phạm vi hẹp nhất |
| Nuốt exception rồi trả 200 | Client không biết đã hỏng | `@ControllerAdvice` + status đúng |
| Lười, để `List<Entity>` lazy rồi truy cập ở view | `LazyInitializationException` lúc chạy thật | Fetch tường minh bằng `@EntityGraph` |

## 8. Snippet then chốt

**Controller mỏng, có validate:**

```java
@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {
    private final BookingService service;

    @PostMapping
    public ResponseEntity<BookingResponse> create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody CreateBookingRequest req) {
        var booking = service.create(jwt.getSubject(), req);
        return ResponseEntity.status(HttpStatus.CREATED).body(BookingResponse.from(booking));
    }
}
```

**DTO là record, không phải entity:**

```java
public record CreateBookingRequest(
    @NotBlank(message = "Chưa nhập tên khách") String customerName,
    @NotNull @Future(message = "Thời gian phải ở tương lai") Instant startsAt
) {}
```

**Repository luôn kèm userId:**

```java
public interface BookingRepository extends JpaRepository<BookingEntity, UUID> {
    Optional<BookingEntity> findByIdAndUserId(UUID id, String userId);
    boolean existsByResourceIdAndStartsAt(UUID resourceId, Instant startsAt);
}
```

**Xử lý lỗi tập trung, thông báo tiếng Việt:**

```java
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(SlotTakenException.class)
    ResponseEntity<ApiError> slotTaken(SlotTakenException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ApiError("Khung giờ này đã có lịch, chọn giờ khác giúp bạn nhé"));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> invalid(MethodArgumentNotValidException e) {
        var msg = e.getBindingResult().getFieldErrors().stream()
            .findFirst().map(FieldError::getDefaultMessage)
            .orElse("Dữ liệu không hợp lệ");
        return ResponseEntity.badRequest().body(new ApiError(msg));
    }
}
```

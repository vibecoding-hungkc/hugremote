import { Body, Controller, Get, Param, Post, Put, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import * as path from 'node:path';
import { LIMITS } from '@app/shared';
import { FilesService } from './files.service';
import { FsActionDto, FsListQuery, FsPathQuery, FsReadQuery, FsSearchQuery, FsUploadDto, FsWriteDto } from './dto/files.dto';

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

/** files-api.v1. Member dùng được trong dự án (PERSONAS §2). */
@ApiTags('files')
@Controller('projects/:id')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get('fs')
  list(@Param('id') id: string, @Query() q: FsListQuery) {
    return this.files.list(id, q.path ?? '', !!q.hidden);
  }

  @Get('fs/read')
  read(@Param('id') id: string, @Query() q: FsReadQuery) {
    return this.files.read(id, q.path, q.tail);
  }

  /** Ảnh/PDF xem trực tiếp; SVG trả kèm CSP chặn script. */
  @Get('fs/raw')
  async raw(@Param('id') id: string, @Query() q: FsPathQuery, @Res() res: Response) {
    const f = await this.files.raw(id, q.path);
    res.setHeader('Content-Type', MIME[path.extname(f.name).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(f.data);
  }

  @Put('fs/file')
  write(@Param('id') id: string, @Body() dto: FsWriteDto) {
    return this.files.write(id, dto.path, dto.content, dto.baseMtime);
  }

  @Post('fs/action')
  action(@Param('id') id: string, @Body() dto: FsActionDto) {
    return this.files.action(id, dto.op, dto.path, dto.to);
  }

  /** multipart: `files[]` + `paths[]` (relativePath giữ cấu trúc thư mục). ≤100MB/file, ≤200 file. */
  @Post('fs/upload')
  @UseInterceptors(
    FilesInterceptor('files', LIMITS.UPLOAD_MAX_FILES, { limits: { fileSize: LIMITS.UPLOAD_MAX_BYTES, files: LIMITS.UPLOAD_MAX_FILES } }),
  )
  upload(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[], @Body() dto: FsUploadDto & { paths?: string | string[] }) {
    const paths = Array.isArray(dto.paths) ? dto.paths : dto.paths ? [dto.paths] : [];
    return this.files.upload(
      id,
      dto.dir ?? '',
      (files ?? []).map((f, i) => ({ relativePath: paths[i] || Buffer.from(f.originalname, 'latin1').toString('utf8'), data: f.buffer })),
    );
  }

  @Get('fs/download')
  async download(@Param('id') id: string, @Query() q: FsPathQuery, @Res() res: Response) {
    const f = await this.files.download(id, q.path);
    res.setHeader('Content-Type', f.zip ? 'application/zip' : 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    res.send(f.data);
  }

  @Get('fs/search')
  search(@Param('id') id: string, @Query() q: FsSearchQuery) {
    return this.files.search(id, q.q, { regex: q.regex, caseSensitive: q.case, hidden: q.hidden });
  }

  @Get('fs/files')
  list2(@Param('id') id: string) {
    return this.files.files(id);
  }

  @Get('fs/line-changes')
  lines(@Param('id') id: string, @Query() q: FsPathQuery) {
    return this.files.lineChanges(id, q.path);
  }
}

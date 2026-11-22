import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UserRole } from '@app/shared';
import { Roles } from '../../common/decorators';
import { WorkspaceService } from './workspace.service';
import { BrowseDto, BrowseQuery, CreateProjectDto, DryRunDto, MkdirDto, ProjectDto, RenameProjectDto } from './dto/workspace.dto';

/** workspace-api.v1. Tạo/sửa/xoá dự án, tạo thư mục: owner (PERSONAS §2); duyệt + đọc: mọi người đã đăng nhập. */
@ApiTags('workspace')
@Controller()
export class WorkspaceController {
  constructor(private readonly ws: WorkspaceService) {}

  @Get('hosts/:id/projects')
  list(@Param('id') id: string): Promise<ProjectDto[]> {
    return this.ws.list(id);
  }

  @Get('hosts/:id/browse')
  browse(@Param('id') id: string, @Query() q: BrowseQuery): Promise<BrowseDto> {
    return this.ws.browse(id, q.path);
  }

  @Roles(UserRole.OWNER)
  @Post('hosts/:id/mkdir')
  @HttpCode(200)
  mkdir(@Param('id') id: string, @Body() dto: MkdirDto): Promise<BrowseDto> {
    return this.ws.mkdir(id, dto.path);
  }

  @Get('projects/:id')
  one(@Param('id') id: string): Promise<ProjectDto> {
    return this.ws.getDto(id);
  }

  @Roles(UserRole.OWNER)
  @Post('projects')
  @HttpCode(200)
  create(@Body() dto: CreateProjectDto): Promise<ProjectDto> {
    return this.ws.create(dto.hostId, dto.rootPath, dto.name);
  }

  @Roles(UserRole.OWNER)
  @Patch('projects/:id')
  rename(@Param('id') id: string, @Body() dto: RenameProjectDto): Promise<ProjectDto> {
    return this.ws.rename(id, dto.name);
  }

  @Roles(UserRole.OWNER)
  @Get('projects/:id/remove-preview')
  async preview(@Param('id') id: string): Promise<DryRunDto> {
    return { sessions: await this.ws.countSessions(id) };
  }

  @Roles(UserRole.OWNER)
  @Delete('projects/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.ws.remove(id);
  }
}

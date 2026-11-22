import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CheckoutDto, CommitDto, CommitQuery, CommitsQuery, DiffQuery, DiscardDto, PathsDto, RepoQuery } from './dto/git.dto';
import { GitService } from './git.service';

/** git-api.v1 (member dùng được trong dự án — PERSONAS §2). */
@ApiTags('git')
@Controller('projects/:id/git')
export class GitController {
  constructor(private readonly git: GitService) {}

  @Get('repos') repos(@Param('id') id: string) {
    return this.git.repos(id);
  }
  @Get('status') status(@Param('id') id: string, @Query() q: RepoQuery) {
    return this.git.status(id, q.repo);
  }
  @Get('diff') diff(@Param('id') id: string, @Query() q: DiffQuery) {
    return this.git.diff(id, q.path, !!q.staged, q.repo);
  }
  @Get('branches') branches(@Param('id') id: string, @Query() q: RepoQuery) {
    return this.git.branches(id, q.repo);
  }
  @Get('commits') commits(@Param('id') id: string, @Query() q: CommitsQuery) {
    return this.git.commits(id, q.cursor ?? 0, q.repo);
  }
  @Get('commit/:sha') commit(@Param('id') id: string, @Param('sha') sha: string, @Query() q: CommitQuery) {
    return this.git.commitDetail(id, sha, q.path, q.repo);
  }
  @Post('fetch') @HttpCode(200) fetch(@Param('id') id: string, @Body() b: RepoQuery) {
    return this.git.fetch(id, b.repo);
  }
  @Post('stage') @HttpCode(200) stage(@Param('id') id: string, @Body() b: PathsDto) {
    return this.git.stage(id, b.paths, true, b.repo);
  }
  @Post('unstage') @HttpCode(200) unstage(@Param('id') id: string, @Body() b: PathsDto) {
    return this.git.stage(id, b.paths, false, b.repo);
  }
  @Post('discard') @HttpCode(200) discard(@Param('id') id: string, @Body() b: DiscardDto) {
    return this.git.discard(id, b.path, b.repo);
  }
  @Post('commit') @HttpCode(200) doCommit(@Param('id') id: string, @Body() b: CommitDto) {
    return this.git.commit(id, b.message, b.repo);
  }
  @Post('pull') @HttpCode(200) pull(@Param('id') id: string, @Body() b: RepoQuery) {
    return this.git.pull(id, b.repo);
  }
  @Post('push') @HttpCode(200) push(@Param('id') id: string, @Body() b: RepoQuery) {
    return this.git.push(id, b.repo);
  }
  @Post('checkout') @HttpCode(200) checkout(@Param('id') id: string, @Body() b: CheckoutDto) {
    return this.git.checkout(id, b.branch, !!b.create, b.repo);
  }
}

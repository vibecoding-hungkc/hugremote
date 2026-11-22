import type { components } from './api';

/** Tên gọn cho schema sinh từ OpenAPI — không khai tay kiểu request/response (skill §7). */
export type S = components['schemas'];
export type Host = S['HostDto'];
export type HostList = S['HostListDto'];
export type Project = S['ProjectDto'];
export type Terminal = S['TerminalDto'];
export type Me = S['MeResponseDto'];
export type Browse = S['BrowseDto'];

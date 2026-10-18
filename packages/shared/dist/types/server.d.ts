export interface ServerItem {
    id: string;
    name: string;
    type: 'local' | 'ssh';
    label: string;
    host: string;
    user: string;
    port: number;
    authType?: 'key' | 'password';
    key?: string;
    password?: string;
    desc?: string;
    workspace?: string;
    isConnected?: boolean;
}
export interface ProjectItem {
    id: string;
    serverId: string;
    name: string;
    rootPath: string;
    lastPath?: string;
    updatedAt: number;
}
//# sourceMappingURL=server.d.ts.map
export interface TerminalSessionInfo {
  id: string;
  name: string;
  serverId: string;
  cwd: string;
  cols?: number;
  rows?: number;
  lastActive?: number;
}

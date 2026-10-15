import assert from 'assert';

// Độc lập không phụ thuộc node-pty native module
export interface MockSession {
  id: string;
  name: string;
  serverId: string;
  cwd: string;
  createdAt: number;
  lastActive: number;
  clients: Set<any>;
  backend: any;
}

class TestableSessionManager {
  public sessions = new Map<string, MockSession>();
  public readonly MAX_SESSIONS = 50;
  public readonly IDLE_TIMEOUT_MS = 30 * 60 * 1000;

  public cleanupIdleSessions() {
    const now = Date.now();
    for (const [id, session] of Array.from(this.sessions.entries())) {
      const hasActiveClients = Array.from(session.clients).some(
        (c: any) => c.readyState === 1
      );
      if (!hasActiveClients && now - session.lastActive > this.IDLE_TIMEOUT_MS) {
        console.log(`[Test] Terminating idle session (idle > 30m): ${id}`);
        this.close(id);
      }
    }
  }

  public getOrCreateSession(sessionId: string, lastActiveOffsetMs = 0) {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      existing.lastActive = Date.now();
      return existing;
    }

    this.cleanupIdleSessions();

    if (this.sessions.size >= this.MAX_SESSIONS) {
      const idleSessions = Array.from(this.sessions.values())
        .filter((s) => !Array.from(s.clients).some((c: any) => c.readyState === 1))
        .sort((a, b) => a.lastActive - b.lastActive);

      if (idleSessions.length > 0) {
        const victim = idleSessions[0];
        console.log(`[Test] Releasing least recently active session to make room: ${victim.id}`);
        this.close(victim.id);
      } else {
        throw new Error(`Maximum concurrent terminal sessions reached (${this.MAX_SESSIONS})`);
      }
    }

    const session: MockSession = {
      id: sessionId,
      name: 'session-' + sessionId,
      serverId: 'server-local',
      cwd: '/tmp',
      createdAt: Date.now() - lastActiveOffsetMs,
      lastActive: Date.now() - lastActiveOffsetMs,
      clients: new Set(),
      backend: { kill: () => {} },
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  public close(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
    }
  }
}

async function runSessionManagerTests() {
  console.log('=== TEST SUITE: sessionManager idle auto-cleanup & concurrency ===');

  const sm = new TestableSessionManager();

  // Test 1: Khởi tạo 50 session đang hoạt động
  for (let i = 1; i <= 50; i++) {
    sm.getOrCreateSession(`session-${i}`);
  }
  assert.strictEqual(sm.sessions.size, 50, 'Phải tạo thành công 50 session');
  console.log('✓ Test 1: Đã tạo đủ 50 session (đạt ngưỡng tối đa 50)');

  // Test 2: Giả lập 30 session trở nên idle > 30 phút, sau đó tạo session thứ 51
  const now = Date.now();
  for (let i = 1; i <= 30; i++) {
    const s = sm.sessions.get(`session-${i}`);
    if (s) {
      s.lastActive = now - 35 * 60 * 1000; // idle 35 phút
    }
  }
  console.log('-> Tạo session thứ 51 khi có 30 session idle > 30m:');
  const session51 = sm.getOrCreateSession('session-51');
  assert.ok(session51, 'Session 51 phải được tạo thành công');
  assert.strictEqual(sm.sessions.size, 21, 'Số session sau dọn dẹp phải còn 20 session active + 1 session mới = 21');
  console.log(`✓ Test 2: Tự động terminate 30 session idle > 30m khi tạo mới. Session còn lại: ${sm.sessions.size}`);

  // Test 3: Kịch bản cả 50 session đều chưa quá 30m nhưng chạm mốc 50
  const sm2 = new TestableSessionManager();
  for (let i = 1; i <= 50; i++) {
    // Tất cả đều mới active 5 phút trước
    sm2.getOrCreateSession(`s-${i}`, 5 * 60 * 1000);
  }
  assert.strictEqual(sm2.sessions.size, 50);
  console.log('-> Đạt 50 session chưa idle > 30m, tạo session thứ 51:');
  const s51 = sm2.getOrCreateSession('s-51');
  assert.strictEqual(s51.id, 's-51');
  assert.strictEqual(sm2.sessions.size, 50, 'Session LRU cũ nhất phải bị giải phóng để giữ tổng = 50');
  console.log('✓ Test 3: Cơ chế LRU tự động thu hồi session cũ nhất nhường chỗ cho session mới.');

  console.log('\n=== TẤT CẢ 3 TEST CASES ĐÃ PASS 100% ===');
}

runSessionManagerTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});

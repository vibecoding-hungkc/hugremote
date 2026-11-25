import { CreateTerminalDto } from './dto/terminal.dto';
import { parseTmuxLs } from './terminal.service';
import { validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

describe('tmux (AC-54)', () => {
  it('parse `tmux list-sessions -F`', () => {
    const out = 'demo-api:3:1764028800\ndemo-api-2:1:1764032400\n\n';
    expect(parseTmuxLs(out)).toEqual([
      { name: 'demo-api', windows: 3, createdAt: '2025-11-25T00:00:00.000Z' },
      { name: 'demo-api-2', windows: 1, createdAt: '2025-11-25T01:00:00.000Z' },
    ]);
  });

  it('tên tmux đi vào lệnh shell chỉ nhận whitelist (G-17)', () => {
    const bad = (tmux: string) => validateSync(plainToInstance(CreateTerminalDto, { tmux })).length > 0;
    expect(bad('demo-api_2')).toBe(false);
    for (const t of ['a.b', 'a:b', 'a;rm -rf ~', '$(id)', 'a b', '', 'x'.repeat(65), '`id`']) expect(bad(t)).toBe(true);
  });
});

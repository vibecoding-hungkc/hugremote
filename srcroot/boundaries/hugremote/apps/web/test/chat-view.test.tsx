// @vitest-environment jsdom
import type { ChatItem } from '@app/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../src/i18n';
import { ChatView } from '../src/features/claude/components/ChatView';

afterEach(cleanup);

const baseH = () => ({
  openFile: vi.fn(),
  openDiff: vi.fn(),
  answer: vi.fn(),
  unqueue: vi.fn(),
  resumeQueue: vi.fn(),
  toggleFocus: vi.fn(),
});

describe('ChatView — Agent con (AC-20) & AskUserQuestion (AC-21)', () => {
  it('lồng các bước của agent con vào thẻ Agent cha, không hiện lặp ở ngoài', () => {
    const items: ChatItem[] = [
      { kind: 'tool', id: 'sub1', name: 'Agent', input: { subagent_type: 'Explore', description: 'Quét mã nguồn' }, done: true },
      { kind: 'assistant', id: 'sa1', parentId: 'sub1', text: 'Đang đọc README' },
      { kind: 'tool', id: 'st1', parentId: 'sub1', name: 'Read', input: { file_path: '/repo/README.md' }, done: true },
    ];
    const { container } = render(
      <ChatView items={items} status="done" pending={[]} queue={[]} focus={false} rootPath="/repo" hostName="local" h={baseH()} />,
    );
    expect(screen.getByText(/Explore/)).toBeTruthy();
    expect(screen.getByText('Quét mã nguồn')).toBeTruthy();
    expect(screen.getByText(/2 bước con|2 sub-steps/)).toBeTruthy();
    // bước con nằm bên trong details.subagent, không nằm ngoài .col trực tiếp
    const topTools = container.querySelectorAll('.col > .tool');
    expect(topTools.length).toBe(1);
    expect(container.querySelectorAll('.substeps .tool').length).toBe(1);
  });

  it('AskUserQuestion bắt chọn phương án rồi gửi answers kèm decision allow', () => {
    const h = baseH();
    const items: ChatItem[] = [
      {
        kind: 'interaction',
        id: 'q1',
        tool: 'AskUserQuestion',
        input: {
          questions: [
            {
              question: 'Chọn cơ sở dữ liệu?',
              header: 'DB',
              options: [
                { label: 'SQLite', description: 'Gọn nhẹ' },
                { label: 'Postgres', description: 'Đa kết nối' },
              ],
            },
          ],
        },
      },
    ];
    render(<ChatView items={items} status="awaiting_input" pending={['q1']} queue={[]} focus={false} rootPath="/repo" hostName="local" h={h} />);
    const submit = screen.getByRole('button', { name: /Gửi câu trả lời|Send answer/ }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /SQLite/ }));
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    expect(h.answer).toHaveBeenCalledWith('q1', 'allow', { 'Chọn cơ sở dữ liệu?': 'SQLite' });
  });
});

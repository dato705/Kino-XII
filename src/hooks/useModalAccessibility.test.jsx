import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useModalAccessibility from './useModalAccessibility';

function TestDialog({ open, onClose }) {
  const dialogRef = useModalAccessibility(open, onClose);
  if (!open) return null;

  return <div ref={dialogRef} role="dialog" tabIndex={-1}>
    <button type="button">First action</button>
    <button type="button">Last action</button>
  </div>;
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('useModalAccessibility', () => {
  it('moves focus into the dialog and traps Tab in both directions', async () => {
    const onClose = vi.fn();
    const { getByRole } = render(<TestDialog open onClose={onClose} />);
    const firstAction = getByRole('button', { name: 'First action' });
    const lastAction = getByRole('button', { name: 'Last action' });

    await waitFor(() => expect(document.activeElement).toBe(firstAction));
    fireEvent.keyDown(firstAction, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(lastAction);
    fireEvent.keyDown(lastAction, { key: 'Tab' });
    expect(document.activeElement).toBe(firstAction);
  });

  it('closes on Escape and restores focus and body scrolling', async () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    document.body.style.overflow = 'clip';
    const onClose = vi.fn();
    const { rerender } = render(<TestDialog open onClose={onClose} />);

    await waitFor(() => expect(document.activeElement).not.toBe(trigger));
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();

    rerender(<TestDialog open={false} onClose={onClose} />);
    expect(document.activeElement).toBe(trigger);
    expect(document.body.style.overflow).toBe('clip');
    trigger.remove();
  });
});
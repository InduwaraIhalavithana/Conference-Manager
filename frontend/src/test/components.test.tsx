import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState, type ReactNode } from 'react';
import { AppProvider } from '../context/AppContext';
import CodeEntry from '../components/CodeEntry';
import CustomSelect from '../components/CustomSelect';
import { TimeSelect } from '../components/DatePicker';
import ImageUpload from '../components/ImageUpload';
import { Modal, PasswordInput } from '../components/ui';
import Navbar from '../components/Navbar';

function wrap(ui: ReactNode, route = '/') {
  return render(<AppProvider><MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter></AppProvider>);
}

function signIn(role: 'organizer' | 'admin') {
  // A token that does not expire for a long time; the content is never checked by the UI.
  const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 86400 })).replace(/=+$/, '');
  localStorage.setItem('cm_token', `x.${payload}.y`);
  localStorage.setItem('cm_role', role);
  localStorage.setItem('cm_user', JSON.stringify(role === 'admin'
    ? { id: 1, username: 'admin', email: 'admin@example.com' }
    : { id: 3, first_name: 'Nimal', last_name: 'Perera', email: 'n@example.com', avatar: null, lang: 'en' }));
}

function stubFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
    new Response(JSON.stringify({ unread: 0, items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}

describe('PasswordInput', () => {
  it('shows and hides the password', () => {
    wrap(<PasswordInput aria-label="pw" defaultValue="secret" />);
    const input = screen.getByLabelText('pw') as HTMLInputElement;
    expect(input.type).toBe('password');
    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input.type).toBe('text');
    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input.type).toBe('password');
  });
});

describe('ImageUpload', () => {
  const setup = () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    const { container } = wrap(<ImageUpload current={null} maxMb={2} shape="round" onUpload={onUpload} onRemove={vi.fn()} />);
    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    return { onUpload, input };
  };

  it('refuses other file types with a clear warning', async () => {
    const { onUpload, input } = setup();
    fireEvent.change(input, { target: { files: [new File(['GIF'], 'a.gif', { type: 'image/gif' })] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('JPG, PNG or WebP');
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('refuses images over the size limit and says how big they are', async () => {
    const { onUpload, input } = setup();
    const big = new File([new Uint8Array(3 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [big] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('3.0 MB');
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('uploads an allowed image', async () => {
    const { onUpload, input } = setup();
    fireEvent.change(input, { target: { files: [new File(['x'], 'me.png', { type: 'image/png' })] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledTimes(1));
  });
});

describe('CustomSelect', () => {
  it('opens a themed list outside the page flow and picks with the keyboard', () => {
    const onChange = vi.fn();
    wrap(<CustomSelect ariaLabel="City" value="a" onChange={onChange}
      options={[{ value: 'a', label: 'Colombo' }, { value: 'b', label: 'Kandy' }]} />);
    const button = screen.getByRole('button', { name: 'City' });
    fireEvent.click(button);
    const list = screen.getByRole('listbox');
    expect(list.parentElement).toBe(document.body); // portaled: modals cannot clip it
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

describe('Navbar', () => {
  it('visitors see public links and sign-in buttons', () => {
    stubFetch();
    wrap(<Navbar />);
    expect(screen.getAllByRole('link', { name: /Conferences/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Sign in/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /My Dashboard/ })).toBeNull();
  });

  it('organizers get My Dashboard and their own pages, never admin ones', async () => {
    stubFetch();
    signIn('organizer');
    wrap(<Navbar />);
    expect(screen.getByRole('link', { name: /My Dashboard/ })).toHaveAttribute('href', '/dashboard');
    expect(screen.getByRole('link', { name: /Check-in/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Organizers/ })).toBeNull();
    await act(async () => {});
  });

  it('admins get My Dashboard pointing at the admin area', async () => {
    stubFetch();
    signIn('admin');
    wrap(<Navbar />);
    expect(screen.getByRole('link', { name: /My Dashboard/ })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: /Organizers/ })).toBeInTheDocument();
    await act(async () => {});
  });

  it('switches language for every label', () => {
    stubFetch();
    localStorage.setItem('cm_lang', 'ta');
    wrap(<Navbar />);
    expect(screen.getAllByRole('link', { name: /மாநாடுகள்/ }).length).toBeGreaterThan(0);
  });
});

describe('CodeEntry', () => {
  it('fills all six boxes from a paste and submits the code', async () => {
    const onSubmit = vi.fn(async () => {});
    wrap(<CodeEntry onSubmit={onSubmit} />);
    fireEvent.paste(screen.getByLabelText('1'), { clipboardData: { getData: () => ' 123 456 ' } });
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('123456'));
    expect((screen.getByLabelText('6') as HTMLInputElement).value).toBe('6');
  });

  it('moves along as digits are typed and shows the error after a wrong code', async () => {
    const onSubmit = vi.fn(async () => { throw new Error('nope'); });
    wrap(<CodeEntry onSubmit={onSubmit} />);
    '987654'.split('').forEach((d, i) => fireEvent.change(screen.getByLabelText(String(i + 1)), { target: { value: d } }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('987654'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    // The boxes are cleared for another try.
    expect((screen.getByLabelText('1') as HTMLInputElement).value).toBe('');
  });
});

describe('Modal', () => {
  function TwoFields() {
    const [form, setForm] = useState({ a: '', b: '' });
    // A new onClose on every render, like the real pages pass.
    return (
      <Modal title="Edit" onClose={() => setForm({ a: '', b: '' })}>
        <input aria-label="first" value={form.a} onChange={(e) => setForm({ ...form, a: e.target.value })} />
        <input aria-label="second" value={form.b} onChange={(e) => setForm({ ...form, b: e.target.value })} />
      </Modal>
    );
  }

  it('keeps focus in the field being typed in', () => {
    wrap(<TwoFields />);
    const second = screen.getByLabelText('second') as HTMLInputElement;
    expect(document.activeElement).toBe(screen.getByLabelText('first'));
    second.focus();
    fireEvent.change(second, { target: { value: 'E' } });
    fireEvent.change(second, { target: { value: 'En' } });
    expect(document.activeElement).toBe(second);
    expect(second.value).toBe('En');
  });
});

describe('TimeSelect', () => {
  it('only offers end times after the start time', () => {
    wrap(<TimeSelect ariaLabel="End" value="" onChange={() => {}} after="09:00" />);
    fireEvent.click(screen.getByRole('button', { name: 'End' }));
    const times = screen.getAllByRole('option').map((o) => o.textContent?.trim());
    expect(times).not.toContain('9:00');
    expect(times).not.toContain('6:00');
    expect(times).toContain('9:15');
  });
});


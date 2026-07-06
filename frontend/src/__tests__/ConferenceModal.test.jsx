import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConferenceModal from '../components/ConferenceModal';

vi.mock('../services/api', () => ({
  api: {
    createConference: vi.fn(),
    updateConference: vi.fn(),
  },
}));

import { api } from '../services/api';

const mockT = (key) => key;

beforeEach(() => {
  vi.clearAllMocks();
});

function fillRequiredDate(container) {
  // type="date" inputs need fireEvent.change since userEvent doesn't handle date pickers
  fireEvent.change(container.querySelector('input[type="date"]'), {
    target: { value: '2027-01-01' },
  });
}

describe('ConferenceModal — create mode', () => {
  it('renders title, description, and location text fields', () => {
    render(<ConferenceModal conference={null} token="tok" onSaved={vi.fn()} onClose={vi.fn()} t={mockT} />);
    // title (type=text)[0], description (textarea)[1], location (type=text)[2]
    expect(screen.getAllByRole('textbox')).toHaveLength(3);
  });

  it('calls createConference on submit', async () => {
    api.createConference.mockResolvedValue({ id: 1, title: 'New Conf', date: '2027-01-01', status: 'published' });
    const onSaved = vi.fn();
    const { container } = render(
      <ConferenceModal conference={null} token="tok" onSaved={onSaved} onClose={vi.fn()} t={mockT} />
    );

    await userEvent.type(screen.getAllByRole('textbox')[0], 'New Conf');
    fillRequiredDate(container);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(api.createConference).toHaveBeenCalled());
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows error when API fails', async () => {
    api.createConference.mockRejectedValue(new Error('Server error'));
    const { container } = render(
      <ConferenceModal conference={null} token="tok" onSaved={vi.fn()} onClose={vi.fn()} t={mockT} />
    );

    await userEvent.type(screen.getAllByRole('textbox')[0], 'Bad Conf');
    fillRequiredDate(container);
    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(screen.getByText('Server error')).toBeInTheDocument());
  });

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn();
    render(<ConferenceModal conference={null} token="tok" onSaved={vi.fn()} onClose={onClose} t={mockT} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ConferenceModal — edit mode', () => {
  const existing = {
    id: 5, title: 'Old Title', date: '2027-06-01', time: null,
    location: 'London', max_attendees: null, status: 'published', category: null,
  };

  it('pre-fills title from existing conference', () => {
    render(<ConferenceModal conference={existing} token="tok" onSaved={vi.fn()} onClose={vi.fn()} t={mockT} />);
    expect(screen.getByDisplayValue('Old Title')).toBeInTheDocument();
  });

  it('calls updateConference on submit', async () => {
    api.updateConference.mockResolvedValue({ ...existing, title: 'Updated' });
    const onSaved = vi.fn();
    render(<ConferenceModal conference={existing} token="tok" onSaved={onSaved} onClose={vi.fn()} t={mockT} />);

    const titleInput = screen.getByDisplayValue('Old Title');
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'Updated');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() =>
      expect(api.updateConference).toHaveBeenCalledWith(
        5,
        expect.objectContaining({ title: 'Updated' }),
        'tok'
      )
    );
    expect(onSaved).toHaveBeenCalled();
  });
});

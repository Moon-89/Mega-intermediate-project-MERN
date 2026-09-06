import { describe, expect, test } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from './renderApp.jsx';
import { mockApi, showtimeFixture } from './mockApi.js';

describe('browsing', () => {
  test('the home page lists films from the API', async () => {
    mockApi();
    renderApp('/');

    expect(await screen.findByText('Neon Harbour')).toBeInTheDocument();
    expect(screen.getByText('Paper Tigers')).toBeInTheDocument();
    expect(screen.getByText(/2 films now showing/i)).toBeInTheDocument();
  });

  test('searching narrows the list and hits the API with the query', async () => {
    const { calls } = mockApi();
    const user = userEvent.setup();
    renderApp('/');

    await screen.findByText('Neon Harbour');
    await user.type(screen.getByLabelText(/search films/i), 'paper');

    await waitFor(() => expect(screen.queryByText('Neon Harbour')).not.toBeInTheDocument());
    expect(screen.getByText('Paper Tigers')).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'GET /api/movies' && c.query.get('q') === 'paper')).toBe(true);
  });

  test('an unknown route renders the 404 page', async () => {
    mockApi();
    renderApp('/nowhere');
    expect(await screen.findByText(/rolled its own credits/i)).toBeInTheDocument();
  });

  test('a film page shows its details and showtimes', async () => {
    mockApi();
    renderApp('/movies/neon-harbour');

    expect(await screen.findByRole('heading', { name: 'Neon Harbour', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/2h 18m/)).toBeInTheDocument();
    expect(screen.getByText('Grand Cineplex')).toBeInTheDocument();
    expect(screen.getByText(/23 left/)).toBeInTheDocument();
  });
});

describe('authentication', () => {
  test('signing in stores the session and reveals the account menu', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp('/login');

    await user.click(screen.getByRole('button', { name: /fill customer/i }));
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    await waitFor(() => expect(localStorage.getItem('cinebook.token')).toBe('token-for-user'));
    expect(await screen.findByRole('button', { name: /SV/ })).toBeInTheDocument();
  });

  test('bad credentials surface the API message and keep you signed out', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(screen.getByLabelText(/email/i), 'user@cinebook.dev');
    await user.type(screen.getByLabelText(/password/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /^sign in$/i }));

    expect(await screen.findByText(/email or password is incorrect/i)).toBeInTheDocument();
    expect(localStorage.getItem('cinebook.token')).toBeNull();
  });

  test('a protected route bounces an anonymous visitor to the sign-in page', async () => {
    mockApi();
    renderApp('/bookings');
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });
});

describe('role-based access', () => {
  test('a customer is refused the admin console', async () => {
    mockApi();
    renderApp('/admin', { token: 'token-for-user' });
    expect(await screen.findByText(/admins only/i)).toBeInTheDocument();
  });

  test('an admin sees the dashboard figures', async () => {
    mockApi();
    renderApp('/admin', { token: 'token-for-admin' });

    expect(await screen.findByText(/run the cinema/i)).toBeInTheDocument();
    expect(await screen.findByText('4.2%')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
  });
});

describe('seat booking', () => {
  const seat = (label) => screen.getByRole('button', { name: new RegExp(`^Seat ${label},`) });

  test('the seat map renders, taken seats are disabled, and totals add up', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp(`/book/${showtimeFixture.id}`, { token: 'token-for-user' });

    expect(await screen.findByText(/pick your seats/i)).toBeInTheDocument();
    expect(seat('A3')).toBeDisabled();
    expect(seat('A1')).toBeEnabled();

    await user.click(seat('A1'));
    await user.click(seat('C2'));

    const summary = screen.getByText('Your order').closest('.summary-card');
    // 200 + 280 = 480 subtotal, 6% fee = 29, total 509
    expect(within(summary).getByText('₹480')).toBeInTheDocument();
    expect(within(summary).getByText('₹509')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm 2 seats/i })).toBeEnabled();
  });

  test('confirming posts the selected seats and lands on the ticket', async () => {
    const { calls } = mockApi();
    const user = userEvent.setup();
    renderApp(`/book/${showtimeFixture.id}`, { token: 'token-for-user' });

    await screen.findByText(/pick your seats/i);
    await user.click(seat('B4'));
    await user.click(screen.getByRole('button', { name: /confirm 1 seat/i }));

    await waitFor(() => {
      const post = calls.find((c) => c.key === 'POST /api/bookings');
      expect(post).toBeDefined();
      expect(post.body.seats).toEqual(['B4']);
    });
    expect(await screen.findByText(/CB-ABC123/)).toBeInTheDocument();
  });

  test('a seat taken mid-flow shows the conflict and drops it from the selection', async () => {
    mockApi({
      'POST /api/bookings': ({ json }) =>
        json(
          {
            error: {
              code: 'SEATS_UNAVAILABLE',
              message: 'Seat(s) B4 were just booked by someone else',
              details: { unavailableSeats: ['B4'] },
            },
          },
          409,
        ),
    });
    const user = userEvent.setup();
    renderApp(`/book/${showtimeFixture.id}`, { token: 'token-for-user' });

    await screen.findByText(/pick your seats/i);
    await user.click(seat('B4'));
    await user.click(screen.getByRole('button', { name: /confirm 1 seat/i }));

    expect(await screen.findByText(/just booked by someone else/i)).toBeInTheDocument();
    await waitFor(() => expect(seat('B4')).toHaveAttribute('aria-pressed', 'false'));
  });

  test('an anonymous visitor is asked to sign in before paying', async () => {
    mockApi();
    const user = userEvent.setup();
    renderApp(`/book/${showtimeFixture.id}`);

    await screen.findByText(/pick your seats/i);
    await user.click(seat('B1'));
    expect(screen.getByRole('button', { name: /sign in to book/i })).toBeInTheDocument();
  });
});

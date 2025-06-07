import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import Campaign from './Campaign';
import type { NostrEvent } from '@nostrify/nostrify';

// Mock the hooks
vi.mock('@/hooks/useCampaigns', () => ({
  useCampaign: () => ({
    data: {
      pubkey: 'test-pubkey',
      dTag: 'test-dtag',
      title: 'Test Campaign',
      description: 'Test Description',
      podcast: 'Test Podcast',
      target: 1000000,
      ticketPrice: 10000,
      endDate: Math.floor(Date.now() / 1000) + 86400,
      isActive: true,
      createdAt: Math.floor(Date.now() / 1000),
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useCampaignStats', () => ({
  useCampaignStats: () => ({
    data: {
      totalRaised: 500000,
      totalTickets: 50,
      uniqueParticipants: 3,
      purchases: [
        {
          id: 'purchase1',
          pubkey: 'user1',
          amount: 200000,
          tickets: 20,
          createdAt: 1000,
          paymentHash: 'hash1',
          bolt11: 'invoice1',
          event: {} as NostrEvent,
        },
        {
          id: 'purchase2',
          pubkey: 'user2',
          amount: 150000,
          tickets: 15,
          createdAt: 2000,
          paymentHash: 'hash2',
          bolt11: 'invoice2',
          event: {} as NostrEvent,
        },
        {
          id: 'purchase3',
          pubkey: 'user1',
          amount: 150000,
          tickets: 15,
          createdAt: 3000,
          paymentHash: 'hash3',
          bolt11: 'invoice3',
          event: {} as NostrEvent,
        },
      ],
    },
  }),
  useUserTickets: () => ({ data: [] }),
}));

vi.mock('@/hooks/useAuthor', () => ({
  useAuthor: (pubkey: string) => ({
    data: {
      metadata: {
        name: pubkey === 'user1' ? 'Alice' : pubkey === 'user2' ? 'Bob' : 'Test User',
        picture: undefined,
      },
    },
  }),
}));

vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => ({ user: null }),
}));

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useParams: () => ({ pubkey: 'test-pubkey', dTag: 'test-dtag' }),
    Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
      <a href={to}>{children}</a>
    ),
  };
});

describe('Campaign', () => {
  it('displays all participants with their ticket counts', () => {
    render(
      <TestApp>
        <Campaign />
      </TestApp>
    );

    // Check that the participants section is rendered
    expect(screen.getByText('All Participants (3)')).toBeInTheDocument();
    expect(screen.getByText('Everyone who bought tickets for this campaign')).toBeInTheDocument();

    // Check that participants are displayed with correct ticket counts
    // Alice should have 35 tickets total (20 + 15 from two purchases)
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('35 tickets')).toBeInTheDocument();
    expect(screen.getByText('2 purchases')).toBeInTheDocument();

    // Bob should have 15 tickets from one purchase
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('15 tickets')).toBeInTheDocument();
    expect(screen.getByText('1 purchase')).toBeInTheDocument();
  });
});
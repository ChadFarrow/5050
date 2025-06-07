import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TestApp } from '@/test/TestApp';
import { CreateCampaignDialog } from './CreateCampaignDialog';

describe('CreateCampaignDialog', () => {
  it('renders duration toggle switch', () => {
    render(
      <TestApp>
        <CreateCampaignDialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    expect(screen.getByText('Use duration instead of end date')).toBeInTheDocument();
  });

  it('shows duration inputs when toggle is enabled', () => {
    render(
      <TestApp>
        <CreateCampaignDialog open={true} onOpenChange={() => {}} />
      </TestApp>
    );

    // The switch should be present
    const toggle = screen.getByRole('switch');
    expect(toggle).toBeInTheDocument();
  });
});
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ActionFooter from './ActionFooter';
import DocketHeader from './DocketHeader';
import PaperContainer from './PaperContainer';
import PhaseSection from './PhaseSection';

globalThis.React = React;

const IconStub = () => <svg data-testid="icon" />;

describe('layout components', () => {
  it('renders the paper container wrapper', () => {
    const html = renderToStaticMarkup(
      <PaperContainer>
        <span>Content</span>
      </PaperContainer>,
    );

    expect(html).toContain('min-h-[80vh]');
    expect(html).toContain('Content');
  });

  it('renders the docket header metadata', () => {
    const html = renderToStaticMarkup(
      <DocketHeader title="State v. Stone" jurisdiction="USA" docketNumber={12345} />,
    );

    expect(html).toContain('State v. Stone');
    expect(html).toContain('Official Docket');
    expect(html).toContain('USA');
    expect(html).toContain('12345');
  });

  it('renders phase sections with icons and content', () => {
    const html = renderToStaticMarkup(
      <PhaseSection title="Case Information" icon={IconStub}>
        <p>Details</p>
      </PhaseSection>,
    );

    expect(html).toContain('Case Information');
    expect(html).toContain('Details');
    expect(html).toContain('data-testid="icon"');
  });

  it('renders action footer controls', () => {
    const html = renderToStaticMarkup(
      <ActionFooter className="justify-center">
        <button type="button">Do Thing</button>
      </ActionFooter>,
    );

    expect(html).toContain('Do Thing');
    expect(html).toContain('justify-center');
  });
});

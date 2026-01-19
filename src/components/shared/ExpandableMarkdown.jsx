import { useEffect, useId, useRef, useState } from 'react';
import MarkdownText from './MarkdownText';

/**
 * Renders markdown text with a line-clamped preview and a toggle to reveal the full content.
 *
 * @param {object} props - Component props.
 * @param {string} props.text - Markdown text to render.
 * @param {number} [props.previewLines=3] - Number of lines to show in the collapsed preview.
 * @param {string} [props.className] - Additional classes applied to the text container.
 * @param {string} [props.toggleClassName] - Additional classes applied to the toggle button.
 * @returns {JSX.Element} The expandable markdown block.
 */
const ExpandableMarkdown = ({
  text = '',
  previewLines = 3,
  className = '',
  toggleClassName = '',
}) => {
  const textId = useId();
  const textRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element || isExpanded) {
      return;
    }

    const hasLayout = element.clientHeight > 0;
    const measuredOverflow = element.scrollHeight > element.clientHeight + 1;
    const estimatedOverflow = text.length > previewLines * 120;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOverflowing(hasLayout ? measuredOverflow : estimatedOverflow);
  }, [isExpanded, previewLines, text]);

  const clampStyles =
    !isExpanded
      ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: previewLines,
          overflow: 'hidden',
        }
      : {};

  return (
    <div>
      <div
        id={textId}
        ref={textRef}
        className={className}
        style={clampStyles}
      >
        <MarkdownText text={text} />
      </div>
      {isOverflowing && (
        <button
          type="button"
          aria-controls={textId}
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((prev) => !prev)}
          className={`mt-2 text-xs font-semibold text-slate-500 hover:text-slate-700 ${toggleClassName}`}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

export default ExpandableMarkdown;

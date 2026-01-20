const stripHtml = (text = '') => text.replace(/<[^>]*>/g, '');

const parseMarkdown = (text = '') => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;
  let inCodeBlock = false;
  let codeLines = [];

  const flushCodeBlock = () => {
    if (codeLines.length > 0) {
      blocks.push({ type: 'code', text: codeLines.join('\n') });
      codeLines = [];
    }
  };

  while (index < lines.length) {
    const line = lines[index];

    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      index += 1;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      index += 1;
      continue;
    }

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      index += 1;
      continue;
    }

    const listMatch = line.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const ordered = /^\s*\d+\./.test(listMatch[1]);
      const items = [];

      while (index < lines.length) {
        const listLine = lines[index];
        const listItemMatch = listLine.match(/^\s*([-*]|\d+\.)\s+(.*)$/);
        if (!listItemMatch) {
          break;
        }

        const isOrderedItem = /^\s*\d+\./.test(listItemMatch[1]);
        if (ordered !== isOrderedItem) {
          break;
        }

        items.push(listItemMatch[2]);
        index += 1;
      }

      blocks.push({ type: ordered ? 'ordered-list' : 'unordered-list', items });
      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index];
      if (!nextLine.trim()) {
        break;
      }
      if (nextLine.trim().startsWith('```')) {
        break;
      }
      if (/^(#{1,4})\s+/.test(nextLine)) {
        break;
      }
      if (/^\s*([-*]|\d+\.)\s+/.test(nextLine)) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    blocks.push({ type: 'paragraph', text: paragraphLines.join('\n') });
  }

  if (inCodeBlock) {
    flushCodeBlock();
  }

  return blocks;
};

const renderInline = (text, keyPrefix) => {
  const segments = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);

  return segments.map((segment, segmentIndex) => {
    if (segment.startsWith('**') && segment.endsWith('**')) {
      const content = segment.slice(2, -2);
      return (
        <strong key={`${keyPrefix}-strong-${segmentIndex}`} className="font-semibold">
          {content}
        </strong>
      );
    }

    if (segment.startsWith('*') && segment.endsWith('*')) {
      const content = segment.slice(1, -1);
      return (
        <em key={`${keyPrefix}-em-${segmentIndex}`} className="italic">
          {content}
        </em>
      );
    }

    return <span key={`${keyPrefix}-text-${segmentIndex}`}>{segment}</span>;
  });
};

const headingClasses = {
  1: 'text-lg font-bold',
  2: 'text-base font-semibold',
  3: 'text-sm font-semibold',
  4: 'text-sm font-medium uppercase tracking-wide',
};

const MarkdownText = ({ text = '', className = '' }) => {
  let blocks = [];
  let sanitizedText = text;

  try {
    if (typeof text === 'string') {
      sanitizedText = stripHtml(text);
    }
    blocks = parseMarkdown(sanitizedText);
  } catch {
    return <span className={className}>{String(text ?? '')}</span>;
  }
  const containerClassName = ['space-y-3', className].filter(Boolean).join(' ');

  if (blocks.length === 0) {
    return <span className={className}>{sanitizedText}</span>;
  }

  return (
    <div className={containerClassName}>
      {blocks.map((block, blockIndex) => {
        const key = `block-${blockIndex}`;

        if (block.type === 'heading') {
          const HeadingTag = `h${Math.min(6, block.level + 2)}`;
          const headingClass = headingClasses[block.level] ?? 'text-sm font-semibold';

          return (
            <HeadingTag key={key} className={headingClass}>
              {renderInline(stripHtml(block.text), key)}
            </HeadingTag>
          );
        }

        if (block.type === 'unordered-list' || block.type === 'ordered-list') {
          const ListTag = block.type === 'ordered-list' ? 'ol' : 'ul';
          const listClassName =
            block.type === 'ordered-list'
              ? 'list-decimal pl-6 space-y-1'
              : 'list-disc pl-6 space-y-1';

          return (
            <ListTag key={key} className={listClassName}>
              {block.items.map((item, itemIndex) => (
                <li key={`${key}-item-${itemIndex}`}>
                  {renderInline(stripHtml(item), key)}
                </li>
              ))}
            </ListTag>
          );
        }

        if (block.type === 'code') {
          return (
            <pre
              key={key}
              className="bg-slate-900 text-slate-100 text-xs p-3 rounded-md overflow-x-auto"
            >
              <code>{block.text}</code>
            </pre>
          );
        }

        return (
          <p key={key} className="whitespace-pre-wrap">
            {renderInline(stripHtml(block.text), key)}
          </p>
        );
      })}
    </div>
  );
};

export default MarkdownText;

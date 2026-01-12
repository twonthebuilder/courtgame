import React from 'react';

/**
 * Aligns action buttons and controls to provide consistent section footers.
 *
 * @param {object} props - Component props.
 * @param {React.ReactNode} props.children - Controls to render in the footer.
 * @param {string} [props.className] - Additional class names to apply to the wrapper.
 * @returns {JSX.Element} The action footer layout.
 */
const ActionFooter = ({ children, className = '' }) => (
  <div className={`mt-4 flex justify-end ${className}`}>{children}</div>
);

export default ActionFooter;

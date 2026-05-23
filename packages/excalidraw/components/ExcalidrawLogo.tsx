import "./ExcalidrawLogo.scss";

const LogoIcon = () => (
  <svg
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="ExcalidrawLogo-icon"
  >
    <rect width="40" height="40" rx="8" fill="currentColor" opacity="0.12" />
    <text
      x="20"
      y="27"
      textAnchor="middle"
      fontSize="22"
      fontWeight="700"
      fill="currentColor"
      fontFamily="system-ui, sans-serif"
    >
      N
    </text>
  </svg>
);

const LogoText = () => (
  <svg
    viewBox="0 0 280 36"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    className="ExcalidrawLogo-text"
  >
    <text
      x="0"
      y="28"
      fontSize="24"
      fontWeight="700"
      fill="currentColor"
      fontFamily="system-ui, sans-serif"
    >
      Nerd Studio Draw
    </text>
  </svg>
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom" | "mobile";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
  /**
   * If true, the logo will not be wrapped in a Link component.
   * The link prop will be ignored as well.
   * It will merely be a plain div.
   */
  isNotLink?: boolean;
}

export const ExcalidrawLogo = ({
  style,
  size = "small",
  withText,
}: LogoProps) => {
  return (
    <div className={`ExcalidrawLogo is-${size}`} style={style}>
      <LogoIcon />
      {withText && <LogoText />}
    </div>
  );
};

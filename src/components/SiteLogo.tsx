import { useEffect, useMemo, useState } from 'react';
import { getSiteLogoCandidates } from '../lib/siteLogo';

interface SiteLogoProps {
  name: string;
  website?: string;
  logo?: string;
  containerClassName: string;
  imgClassName: string;
  placeholderClassName?: string;
}

export function SiteLogo({
  name,
  website,
  logo,
  containerClassName,
  imgClassName,
  placeholderClassName = 'h-2 w-2 rounded-full bg-black/25',
}: SiteLogoProps) {
  const candidates = useMemo(() => getSiteLogoCandidates(website, logo), [website, logo]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [candidates]);

  const activeSrc = activeIndex < candidates.length ? candidates[activeIndex] : '';

  return (
    <div className={containerClassName}>
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={`${name} logo`}
          className={imgClassName}
          onError={() => {
            setActiveIndex((current) => current + 1);
          }}
        />
      ) : (
        <span className={placeholderClassName} />
      )}
    </div>
  );
}

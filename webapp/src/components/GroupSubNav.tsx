import React from 'react';

type Props = { groupId: string };

export default function GroupSubNav({ groupId }: Props) {
  const [hash, setHash] = React.useState<string>(window.location.hash || '#/');

  React.useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const base = `#/group/${groupId}`;
  const items = [
    { key: 'verses',    label: 'Verses' },
    { key: 'devotions', label: 'Devotions' },
    { key: 'study',     label: 'Study' },
    { key: 'journal',   label: 'Journal' },
    { key: 'prayers',   label: 'Prayers' },
  ];

  const href = (k: string) => `${base}/${k}`;
  const isActive = (k: string) => hash === href(k) || hash.startsWith(`${href(k)}`);

  return (
    <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b">
      <nav className="max-w-5xl mx-auto flex items-center gap-1 px-4 overflow-x-auto">
        {items.map(it => (
          <a
            key={it.key}
            href={href(it.key)}
            aria-current={isActive(it.key) ? 'page' : undefined}
            className={`px-3 py-2 border-b-2 whitespace-nowrap ${
              isActive(it.key)
                ? 'font-semibold border-gray-900'
                : 'border-transparent hover:border-gray-300'
            }`}
          >
            {it.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

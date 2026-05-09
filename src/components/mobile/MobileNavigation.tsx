import { Home, Search, Library } from 'lucide-react';
import styles from './MobileNavigation.module.css';

type Tab = 'home' | 'search' | 'library';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: typeof Home; activeIcon: typeof Home }[] = [
  { id: 'home', label: '首页', icon: Home, activeIcon: Home },
  { id: 'search', label: '搜索', icon: Search, activeIcon: Search },
  { id: 'library', label: '音乐库', icon: Library, activeIcon: Library },
];

export function MobileNavigation({ activeTab, onTabChange }: Props) {
  return (
    <nav className={styles.nav}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <Icon size={24} fill={isActive ? 'currentColor' : 'none'} />
            <span className={styles.label}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

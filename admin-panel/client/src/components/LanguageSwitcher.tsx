import { useLanguage } from '@/contexts/LanguageContext';
import { Language, languages } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';

interface LanguageSwitcherProps {
  variant?: 'default' | 'compact' | 'inline';
  showLabel?: boolean;
}

export function LanguageSwitcher({ variant = 'default', showLabel = true }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useLanguage();

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-1">
        {(Object.keys(languages) as Language[]).map((lang, idx) => (
          <span key={lang} className="flex items-center">
            <button
              onClick={() => setLanguage(lang)}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                language === lang
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {lang.toUpperCase()}
            </button>
            {idx < Object.keys(languages).length - 1 && (
              <span className="text-muted-foreground mx-1">|</span>
            )}
          </span>
        ))}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 px-2">
            <span className="text-base mr-1">{languages[language].flag}</span>
            <span className="text-xs font-medium">{language.toUpperCase()}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(languages) as Language[]).map((lang) => (
            <DropdownMenuItem
              key={lang}
              onClick={() => setLanguage(lang)}
              className={language === lang ? 'bg-accent' : ''}
            >
              <span className="text-base mr-2">{languages[lang].flag}</span>
              <span>{languages[lang].name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Globe className="h-4 w-4" />
          {showLabel && (
            <>
              <span className="text-base">{languages[language].flag}</span>
              <span>{languages[language].name}</span>
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {(Object.keys(languages) as Language[]).map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={() => setLanguage(lang)}
            className={language === lang ? 'bg-accent' : ''}
          >
            <span className="text-base mr-2">{languages[lang].flag}</span>
            <span>{languages[lang].name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
type Theme='system'|'light'|'dark';
const ThemeContext=createContext<{theme:Theme;setTheme:(theme:Theme)=>void}>({theme:'system',setTheme:()=>{}});
function savedTheme():Theme {try{const value=localStorage.getItem('financy-theme');return value==='light'||value==='dark'?value:'system';}catch{return 'system';}}
export function ThemeProvider({children}:{children:ReactNode}){
  const [theme,setTheme]=useState<Theme>(savedTheme);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>{const resolved=theme==='system'?(media.matches?'dark':'light'):theme;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolved==='dark'?'#13211b':'#f7f9f6');};
    apply();try{localStorage.setItem('financy-theme',theme);}catch{}
    media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);
  },[theme]);
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key==='financy-theme')setTheme(savedTheme());};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  return <ThemeContext.Provider value={{theme,setTheme}}>{children}</ThemeContext.Provider>;
}
export function ThemeSelect(){const {theme,setTheme}=useContext(ThemeContext);const Icon=theme==='system'?Monitor:theme==='dark'?Moon:Sun;return <label className="theme-select"><Icon size={17} aria-hidden="true"/><select aria-label="Apariencia" value={theme} onChange={e=>setTheme(e.target.value as Theme)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>;}

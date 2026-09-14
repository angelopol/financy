import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Monitor, Moon, Sun, Type } from 'lucide-react';
type Theme='system'|'light'|'dark';
type ChatFontSize='normal'|'large'|'xlarge';
const ThemeContext=createContext<{theme:Theme;setTheme:(theme:Theme)=>void;chatFontSize:ChatFontSize;setChatFontSize:(size:ChatFontSize)=>void}>({theme:'system',setTheme:()=>{},chatFontSize:'normal',setChatFontSize:()=>{}});
function savedTheme():Theme {try{const value=localStorage.getItem('financy-theme');return value==='light'||value==='dark'?value:'system';}catch{return 'system';}}
function savedChatFontSize():ChatFontSize {try{const value=localStorage.getItem('financy-chat-font-size');return value==='large'||value==='xlarge'?value:'normal';}catch{return 'normal';}}
export function ThemeProvider({children}:{children:ReactNode}){
  const [theme,setTheme]=useState<Theme>(savedTheme);
  const [chatFontSize,setChatFontSize]=useState<ChatFontSize>(savedChatFontSize);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-color-scheme: dark)');
    const apply=()=>{const resolved=theme==='system'?(media.matches?'dark':'light'):theme;document.documentElement.dataset.theme=resolved;document.documentElement.style.colorScheme=resolved;document.querySelector('meta[name="theme-color"]')?.setAttribute('content',resolved==='dark'?'#13211b':'#f7f9f6');};
    apply();try{localStorage.setItem('financy-theme',theme);}catch{}
    media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);
  },[theme]);
  useEffect(()=>{document.documentElement.dataset.chatFontSize=chatFontSize;try{localStorage.setItem('financy-chat-font-size',chatFontSize);}catch{}},[chatFontSize]);
  useEffect(()=>{const sync=(event:StorageEvent)=>{if(event.key==='financy-theme')setTheme(savedTheme());if(event.key==='financy-chat-font-size')setChatFontSize(savedChatFontSize());};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
  return <ThemeContext.Provider value={{theme,setTheme,chatFontSize,setChatFontSize}}>{children}</ThemeContext.Provider>;
}
export function ThemeSelect(){const {theme,setTheme}=useContext(ThemeContext);const Icon=theme==='system'?Monitor:theme==='dark'?Moon:Sun;return <label className="theme-select"><Icon size={17} aria-hidden="true"/><select aria-label="Apariencia" value={theme} onChange={e=>setTheme(e.target.value as Theme)}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Oscuro</option></select></label>;}
export function ChatFontSizeSelect(){const {chatFontSize,setChatFontSize}=useContext(ThemeContext);return <label className="theme-select" id="chat-font-size-setting"><Type size={17} aria-hidden="true"/><select aria-label="Tamaño de letra del chat" value={chatFontSize} onChange={e=>setChatFontSize(e.target.value as ChatFontSize)}><option value="normal">Normal</option><option value="large">Grande</option><option value="xlarge">Muy grande</option></select></label>;}

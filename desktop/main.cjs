const { app, BrowserWindow, ipcMain, session, dialog, protocol } = require('electron');
const { readFile, writeFile, mkdir, rename } = require('node:fs/promises');
const path = require('node:path');
const repository = require('../config/repository.json');
let window, savePath, saveQueue = Promise.resolve(), closing = false, closeTimer;
const origin = 'codebound://app';
protocol.registerSchemesAsPrivileged([{ scheme:'codebound', privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true} }]);
const types = { '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.wasm':'application/wasm','.zip':'application/zip','.py':'text/plain; charset=utf-8' };
function senderAllowed(event) { return Boolean(origin && event.senderFrame?.url.startsWith(`${origin}/`)); }
function registerResources() {
  const root = path.join(app.getAppPath(), 'dist');
  protocol.handle('codebound',async request => {
    try {
      const url = new URL(request.url, origin);
      if (url.host !== 'app' || !['GET','HEAD'].includes(request.method)) return new Response('Forbidden',{status:403});
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const file = path.resolve(root, `.${relative}`);
      if (!file.startsWith(root + path.sep)) return new Response('Forbidden',{status:403});
      const bytes = await readFile(file);
      return new Response(request.method === 'HEAD' ? null : bytes, { headers:{ 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-cache', 'X-Content-Type-Options':'nosniff' } });
    } catch { return new Response('Not found',{status:404}); }
  });
}
async function checkUpdates() {
  if (!repository.owner || !repository.repo) return { state:'unconfigured', message:'GitHub 更新接口已预留。配置发行仓库后即可检查版本。' };
  if (repository.private) return { state:'private-source', message:`已关联 ${repository.owner}/${repository.repo}。当前是私有仓库，尚未配置可供玩家访问的发行包源；Alpha 暂不执行自动安装。` };
  const url = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/releases/latest`;
  const response = await fetch(url,{ headers:{ Accept:'application/vnd.github+json', 'User-Agent':'Codebound' },signal:AbortSignal.timeout(10000) });
  if (response.status === 404) return {state:'no-release',message:'仓库尚无正式发行版本，可以继续使用当前 Alpha。'};
  if (!response.ok) throw new Error('更新源连接失败。');
  const release = await response.json();
  const latest = String(release.tag_name || '').replace(/^v/,'');
  const current = app.getVersion();
  return {state:latest === current?'current':'available',version:latest,message:latest===current?'当前已是此更新源中的最新版本。':`发行版本：${latest}；本机版本：${current}。Alpha 已支持查询，签名下载与安装接口将随正式发布接入。`};
}
app.setName('Codebound');
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{ if(window){ if(window.isMinimized())window.restore(); window.show(); window.focus(); } });
  app.whenReady().then(async () => {
    try {
      const saveDirectory = app.getPath('userData'); await mkdir(saveDirectory,{recursive:true}); savePath=path.join(saveDirectory,'progress.v1.json');
      registerResources();
      session.defaultSession.setPermissionRequestHandler((webContents,permission,callback)=>callback(false));
      session.defaultSession.setPermissionCheckHandler(()=>false);
      ipcMain.handle('save:load',async event=>{
        if(!senderAllowed(event)) throw new Error('来源不受支持。');
        try { return JSON.parse(await readFile(savePath,'utf8')); } catch(error){ if(error.code==='ENOENT') return null; throw error; }
      });
      ipcMain.handle('save:write',async (event,value)=>{
        if(!senderAllowed(event)||!value||value.schemaVersion!==1) throw new Error('存档无效。');
        const data=JSON.stringify(value); if(Buffer.byteLength(data)>1000000) throw new Error('存档过大。');
        const operation=saveQueue.catch(()=>{}).then(async()=>{
          const temporary=`${savePath}.tmp`; await writeFile(temporary,data,'utf8'); await rename(temporary,savePath);
        }); saveQueue=operation; await operation; return true;
      });
      ipcMain.handle('updates:check',async event=>{ if(!senderAllowed(event))throw new Error('来源不受支持。');return checkUpdates(); });
      const finishClose=()=>{ clearTimeout(closeTimer);saveQueue.catch(()=>{}).finally(()=>{closing=true;window?.destroy();app.quit();}); };
      ipcMain.on('save:flushed',event=>{if(senderAllowed(event))finishClose();});
      window=new BrowserWindow({width:1440,height:1000,minWidth:900,minHeight:700,backgroundColor:'#0d1218',title:'Codebound · 码境远征',autoHideMenuBar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,nodeIntegrationInWorker:false,sandbox:true,spellcheck:false}});
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
      window.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith(`${origin}/`))event.preventDefault();});
      window.once('ready-to-show',()=>window.show());
      window.on('close',event=>{if(!closing){event.preventDefault();window.webContents.send('save:flush');clearTimeout(closeTimer);closeTimer=setTimeout(finishClose,1500);}});
      window.on('closed',()=>{window=null;app.quit();});
      await window.loadURL(`${origin}/index.html`);
    } catch(error){dialog.showErrorBox('Codebound 启动失败',String(error.message));app.quit();}
  });
}
app.on('window-all-closed',()=>app.quit());

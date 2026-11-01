// Run after npm run build: electron scripts/desktop-smoke.cjs
const {app}=require('electron');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const appRoot=process.argv.includes('--packaged')?path.join(root,'release/win-unpacked/resources/app.asar'):root;
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'codebound-qa-'));
const campaign=require('../content/python/campaign.json');
app.setPath('userData',profile);
app.getAppPath=()=>appRoot;
fs.writeFileSync(path.join(profile,'progress.v1.json'),JSON.stringify({schemaVersion:1,currentLevel:'python.assembly.001',completed:Object.fromEntries(campaign.levels.map(l=>[l.id,{runs:1}])),drafts:{},hints:{},settings:{speed:4,fontSize:15}}));
const timer=setTimeout(()=>{console.error('Desktop smoke timeout');app.exit(1);},30000);
app.on('browser-window-created',(_,win)=>{
 win.webContents.once('did-finish-load',async()=>{
  try {
   const result=await win.webContents.executeJavaScript(`(async()=>{
    const wait=()=>new Promise(r=>setTimeout(r,150));
    for(let i=0;i<100&&!document.querySelector('.breadcrumbs');i++) await wait();
    if(!document.querySelector('.breadcrumbs').textContent.includes('第一幕')) throw Error('幕导航错误');
    document.querySelector('[data-chapter="workshop"]').click();
    document.querySelector('[data-level="python.workshop.010"]').click();await wait();
    if(!document.querySelector('.task-heading').textContent.includes('校园救援调度台')) throw Error('末关导航错误');
    document.querySelector('[data-action="hint"]').click();
    document.querySelector('[data-tab="learn"]').click();
    if(!document.querySelector('#learn-view pre').textContent) throw Error('缺少示例');
    const actPicker=document.querySelector('#act-navigation'); actPicker.value='act-three';actPicker.dispatchEvent(new Event('change',{bubbles:true}));
    document.querySelector('[data-chapter="modules"]').click();
    document.querySelector('[data-level="python.modules.007"]').click();await wait();
    if(!document.querySelector('textarea[aria-label="tools.py"]')) throw Error('模块编辑器缺失');
    document.querySelector('[data-file-kind="main"]').click();
    if(document.querySelector('.virtual-file-name').textContent!=='main.py') throw Error('文件树主文件选择失败');
    document.querySelector('[data-file-name="tools.py"]').click();
    if(!document.querySelector('textarea[aria-label="tools.py"]')) throw Error('文件树模块选择失败');
    document.querySelector('[data-chapter="files"]').click();
    document.querySelector('[data-level="python.files.010"]').click();await wait();
    if(!document.querySelector('#file-preview')) throw Error('档案柜缺失');
    return {title:document.querySelector('.task-heading').textContent,chapters:document.querySelectorAll('[data-chapter]').length,hint:document.querySelector('#hint-count').textContent};
   })()`);
   const level=campaign.levels.find(l=>l.id==='python.files.010');
   const code=require('../tests/solutions.json')[level.id];
   const execution=await win.webContents.executeJavaScript(`new Promise((resolve,reject)=>{
    const worker=new Worker('codebound://app/runner.worker.js',{type:'module'});
    worker.onerror=e=>{worker.terminate();reject(Error(e.message));};
    worker.onmessage=({data})=>{
     if(data.type==='result'){worker.terminate();resolve(data.result);}
     if(data.type==='failure'){worker.terminate();reject(Error(data.message+' '+data.detail));}
    };
    worker.postMessage({type:'run',payload:${JSON.stringify({code,level})}});
   })`);
   if(execution.error||execution.output.trim()!=='2\n5'||execution.checks.some(c=>!c.passed)) throw Error('桌面Worker项目执行失败：'+JSON.stringify(execution.error));
   await win.webContents.executeJavaScript(`document.querySelector('[data-level="python.files.008"]').click(); document.querySelector('.cm-content').focus();`);
   win.webContents.sendInputEvent({type:'keyDown',keyCode:'A',modifiers:['control']});
   win.webContents.sendInputEvent({type:'keyUp',keyCode:'A',modifiers:['control']});
   await win.webContents.insertText(require('../tests/solutions.json')['python.files.008']);
   await win.webContents.executeJavaScript(`document.querySelector('[data-action="run"]').click()`);
   const fileTreeCheck=await win.webContents.executeJavaScript(`(async()=>{
    for(let i=0;i<120&&!document.querySelector('#feedback.success');i++)await new Promise(r=>setTimeout(r,100));
    if(!document.querySelector('#feedback.success'))throw Error('文件题运行失败：'+document.querySelector('#feedback').textContent);
    await new Promise(r=>setTimeout(r,450));document.querySelector('[data-action="close-modal"]')?.click();
    const item=document.querySelector('[data-file-name="record.json"][data-file-kind="file"]');
    if(!item||item.textContent.includes('待生成'))throw Error('生成的文件未更新到树');
    item.click();const record=JSON.parse(document.querySelector('#file-preview').textContent);
    if(record.name!=='校园'||record.count!==3)throw Error('文件预览内容错误');
    [...document.querySelectorAll('#workspace-files button')].find(b=>b.textContent==='保存当前档案快照').click();
    if(!document.querySelector('[data-file-kind="snapshot"]'))throw Error('快照未出现在文件树');
    return true;
   })()`);
   if(!fileTreeCheck) throw Error('文件树验证失败');
   for (const [width,height] of [[1440,1000],[1000,700],[1920,1080]]) {
    win.setSize(width,height);await new Promise(r=>setTimeout(r,400));
    const bounds=await win.webContents.executeJavaScript(`(()=>{const r=document.querySelector('#app').getBoundingClientRect();return {width:r.width,height:r.height,w:innerWidth,h:innerHeight};})()`);
    if(bounds.width>bounds.w+3||bounds.height>bounds.h+3) throw Error('自动缩放超出窗口：'+JSON.stringify(bounds));
   }
   await win.webContents.executeJavaScript(`document.querySelector('[data-action="collapse-sidebar"]').click()`);
   await new Promise(r=>setTimeout(r,200));
   if(!await win.webContents.executeJavaScript(`document.querySelector('.app-shell').classList.contains('sidebar-collapsed')`))throw Error('侧栏未收起');
   await win.webContents.executeJavaScript(`document.querySelector('[data-action="collapse-sidebar"]').click()`);
   await new Promise(r=>setTimeout(r,200));
   const image=await win.webContents.capturePage();fs.writeFileSync(path.join(root,'docs/current-desktop.png'),image.toPNG());
   console.log(JSON.stringify(result));clearTimeout(timer);app.exit(0);
  }catch(error){console.error(error);clearTimeout(timer);app.exit(1);}
 });
});
require(path.join(appRoot,'desktop/main.cjs'));

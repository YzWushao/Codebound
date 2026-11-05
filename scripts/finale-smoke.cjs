// Run after npm run build: electron scripts/finale-smoke.cjs
const {app} = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const campaign = require('../content/python/campaign.json');
const solutions = require('../tests/solutions.json');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'codebound-finale-'));
const artifact = path.join(root, '.local');
fs.mkdirSync(artifact, {recursive: true});
app.setPath('userData', profile);
app.getAppPath = () => root;
fs.writeFileSync(path.join(profile, 'progress.v1.json'), JSON.stringify({
  schemaVersion: 1, currentLevel: 'python.strategy.001',
  completed: {}, unlockedLevels: campaign.levels.map(level => level.id),
  drafts: {}, hints: {}, settings: {speed: 4, fontSize: 15},
}));
const timer = setTimeout(() => { console.error('Finale smoke timeout'); app.exit(1); }, 90000);
const call = (win, fn, ...args) => win.webContents.executeJavaScript('(' + fn.toString() + ')(' + args.map(arg => JSON.stringify(arg)).join(',') + ')');
app.on('browser-window-created', (_, win) => {
  // This is an isolated test window; do not replace the player's desktop window.
  const showTestWindow = win.show.bind(win);
  win.show = () => {};
  win.webContents.setBackgroundThrottling(false);
  win.webContents.once('did-finish-load', async () => {
    try {
      const navigation = await call(win, async () => {
        const wait = () => new Promise(resolve => setTimeout(resolve, 80));
        for (let i = 0; i < 100 && !document.querySelector('.breadcrumbs'); i++) await wait();
        const picker = document.querySelector('#act-navigation');
        if (picker.value !== 'finale' || picker.options.length !== 5) throw Error('终幕导航未加载');
        if (document.querySelectorAll('[data-chapter]').length !== 4) throw Error('终幕区域数量错误');
        document.querySelector('[data-action="overview"]').click();
        const description = document.querySelector('.modal p').textContent;
        if (!description.includes('终幕40关') || !description.includes('180')) throw Error('总览计数错误');
        document.querySelector('[data-action="close-modal"]').click();
        const titles = [];
        for (const [unit, id] of [
          ['strategy', 'python.strategy.010'], ['recursion', 'python.recursion.010'],
          ['objects', 'python.objects.010'], ['expedition', 'python.expedition.010'],
        ]) {
          if (!document.querySelector('[data-level="' + id + '"]')) document.querySelector('[data-chapter="' + unit + '"]').click();
          document.querySelector('[data-level="' + id + '"]').click();
          await wait();
          titles.push(document.querySelector('.task-heading').textContent);
          document.querySelector('[data-tab="learn"]').click();
          if (!document.querySelector('#learn-view pre').textContent) throw Error('关卡示例缺失');
          document.querySelector('[data-action="hint"]').click();
          if (!document.querySelector('#hint-copy').textContent.trim()) throw Error('关卡提示缺失');
          document.querySelector('[data-tab="code"]').click();
        }
        if (document.querySelectorAll('[data-file-kind="module"]').length !== 3) throw Error('毕业项目缺少模块文件');
        document.querySelector('[data-file-kind="main"]').click();
        return {acts: picker.options.length, units: 4, titles};
      });
      const workers = [];
      for (const id of ['python.recursion.010', 'python.objects.004', 'python.expedition.010']) {
        const level = campaign.levels.find(item => item.id === id);
        const result = await call(win, payload => new Promise((resolve, reject) => {
          const worker = new Worker('codebound://app/runner.worker.js', {type: 'module'});
          worker.onerror = error => { worker.terminate(); reject(Error(error.message)); };
          worker.onmessage = ({data}) => {
            if (data.type === 'result') { worker.terminate(); resolve(data.result); }
            if (data.type === 'failure') { worker.terminate(); reject(Error(data.message + ' ' + data.detail)); }
          };
          worker.postMessage({type: 'run', payload});
        }), {code: solutions[id], level});
        if (result.error || result.checks.some(check => !check.passed)) throw Error(id + ': ' + JSON.stringify(result.error || result.checks));
        if (id === 'python.recursion.010' && !result.recursiveFunctions.includes('walk')) throw Error('未记录真实递归');
        if (id === 'python.objects.004' && !result.variables.battery.includes('energy=100')) throw Error('实例状态缺失');
        if (id === 'python.expedition.010' && result.output.trim() !== 'CODEBOUND\n5\n7') throw Error('毕业项目输出错误');
        workers.push({id, output: result.output.trim(), variants: result.checks.length});
      }
      await call(win, () => document.querySelector('.cm-content').focus());
      win.webContents.sendInputEvent({type: 'keyDown', keyCode: 'A', modifiers: ['control']});
      win.webContents.sendInputEvent({type: 'keyUp', keyCode: 'A', modifiers: ['control']});
      await win.webContents.insertText(solutions['python.expedition.010']);
      await call(win, () => document.querySelector('[data-action="run"]').click());
      const graduation = await call(win, async () => {
        for (let i = 0; i < 500 && !document.querySelector('.success-modal'); i++) await new Promise(resolve => setTimeout(resolve, 80));
        if (!document.querySelector('.success-modal')) throw Error('毕业项目界面未通关：' + document.querySelector('#feedback').textContent);
        if (document.querySelector('.success-modal [data-level]')) throw Error('终幕结局不应出现不存在的下一关');
        document.querySelector('[data-action="close-modal"]').click();
        const reportItem = document.querySelector('[data-file-name="report.json"][data-file-kind="file"]');
        if (!reportItem || reportItem.textContent.includes('待生成')) throw Error('报告未生成');
        reportItem.click();
        const report = JSON.parse(document.querySelector('#file-preview').textContent);
        if (report.accepted !== 2 || report.query !== 5 || report.total !== 7) throw Error('报告预览错误');
        return {report, mission: document.querySelector('.task-number').textContent};
      });
      for (const [width, height] of [[1440,1000], [1000,700], [1920,1080]]) {
        win.setSize(width, height);
        await new Promise(resolve => setTimeout(resolve, 200));
        const bounds = await call(win, () => {
          const rect = document.querySelector('#app').getBoundingClientRect();
          return {width: rect.width, height: rect.height, viewportWidth: innerWidth, viewportHeight: innerHeight};
        });
        if (bounds.width > bounds.viewportWidth + 3 || bounds.height > bounds.viewportHeight + 3) throw Error('终幕界面超出视口');
      }
      win.setSize(1440, 1000);
      showTestWindow();
      await new Promise(resolve => setTimeout(resolve, 650));
      const painted = await call(win, () => {
        const canvas = document.querySelector('#world');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) return true;
        return false;
      });
      if (!painted) throw Error('地图画布未绘制');
      const screenshot = await win.webContents.capturePage();
      fs.writeFileSync(path.join(artifact, 'finale-desktop.png'), screenshot.toPNG());
      const report = {navigation, workers, graduation};
      fs.writeFileSync(path.join(artifact, 'finale-desktop.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report));
      clearTimeout(timer);
      app.exit(0);
    } catch (error) {
      console.error(error);
      clearTimeout(timer);
      app.exit(1);
    }
  });
});
require('../desktop/main.cjs');

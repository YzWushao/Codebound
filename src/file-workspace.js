// A view of the lesson's in-memory workspace; it never opens host filesystem paths.
export function createFileWorkspace(host, options) {
  let files = { ...options.files }, saved = { ...options.savedFiles };
  const modules = { ...options.modules };
  let selected = Object.keys(modules).length ? ['module', Object.keys(modules)[0]] : ['file', Object.keys(files)[0] || Object.keys(options.expectedFiles || {})[0]];
  const panel = document.createElement('section'); panel.className = 'file-workspace'; panel.setAttribute('aria-label', '虚拟文件工作区');
  const heading = document.createElement('div'); heading.className = 'file-workspace-heading'; heading.textContent = '虚拟文件工作区';
  const note = document.createElement('small'); note.textContent = '点击文件查看内容 · 每次运行使用独立练习副本'; heading.append(note);
  const body = document.createElement('div'); body.className = 'file-workspace-body';
  const tree = document.createElement('nav'); tree.className = 'virtual-file-tree'; tree.setAttribute('aria-label', '虚拟文件树');
  const viewer = document.createElement('div'); viewer.className = 'virtual-file-viewer';
  const filename = document.createElement('div'); filename.className = 'virtual-file-name';
  const content = document.createElement('div');
  viewer.append(filename, content); body.append(tree, viewer); panel.append(heading, body); host.append(panel);

  function show() {
    const [kind, name] = selected;
    filename.textContent = name || '暂无文件'; content.replaceChildren();
    if (kind === 'module') {
      const editor = document.createElement('textarea'); editor.setAttribute('aria-label', name); editor.spellcheck = false; editor.value = modules[name];
      editor.addEventListener('input', () => { modules[name] = editor.value; options.onModuleChange(name, editor.value); });
      content.append(editor);
    } else {
      const preview = document.createElement('pre'); preview.id = 'file-preview';
      const source = kind === 'snapshot' ? saved : files;
      preview.textContent = kind === 'main' ? options.mainCode() : Object.hasOwn(source, name) ? source[name] || '（空文件）' : '文件尚未创建。运行写入代码后，这里会显示生成的内容。';
      content.append(preview);
      const label = document.createElement('small'); label.textContent = kind === 'main' ? '主文件请在上方代码编辑器中修改。' : kind === 'snapshot' ? '已保存快照 · 只读' : '虚拟文件内容 · 只读'; content.append(label);
    }
  }
  function item(parent, kind, name, pending = false) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'virtual-file-item';
    button.dataset.fileKind = kind; button.dataset.fileName = name;
    button.textContent = name + (pending ? ' · 待生成' : '');
    const active = selected[0] === kind && selected[1] === name;
    if (active) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => { selected = [kind, name]; renderTree(); show(); if (kind === 'main') options.onMain(); });
    parent.append(button);
  }
  function group(title, populate) {
    const folder = document.createElement('details'); folder.open = true;
    const summary = document.createElement('summary'); summary.textContent = title;
    const children = document.createElement('div'); children.className = 'virtual-folder-children';
    populate(children); folder.append(summary, children); tree.append(folder);
  }
  function renderTree() {
    tree.replaceChildren();
    group('代码文件', parent => { item(parent, 'main', 'main.py'); Object.keys(modules).sort().forEach(name => item(parent, 'module', name)); });
    const names = [...new Set([...Object.keys(files), ...Object.keys(options.expectedFiles || {})])].sort();
    group('虚拟档案', parent => {
      if (!names.length) { const empty = document.createElement('small'); empty.textContent = '暂无档案'; parent.append(empty); }
      names.forEach(name => item(parent, 'file', name, !Object.hasOwn(files, name)));
    });
    if (Object.keys(saved).length) group('已保存快照', parent => Object.keys(saved).sort().forEach(name => item(parent, 'snapshot', name)));
  }
  if (options.canSave) {
    const save = document.createElement('button'); save.type = 'button'; save.className = 'secondary-button'; save.textContent = '保存当前档案快照';
    save.addEventListener('click', () => { saved = { ...files }; options.onSave(saved); renderTree(); show(); }); panel.append(save);
  }
  renderTree(); show();
  return {
    update(nextFiles) {
      files = { ...nextFiles };
      // Prefer a newly created file, while keeping an existing selection stable.
      if (!selected[1]) selected = ['file', Object.keys(files)[0]];
      renderTree(); show();
    }
  };
}

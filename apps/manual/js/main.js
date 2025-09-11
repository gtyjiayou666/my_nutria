document.addEventListener('DOMContentLoaded', async () => {
  const renderArea = document.getElementById('markdown-render');
  const docTree = document.getElementById('doc-tree');
  const searchInput = document.getElementById('search-input');

  let allNodes = []; // 用于搜索

  try {
    // 1. 获取文件树结构
    const response = await fetch('filelist.json');
    if (!response.ok) throw new Error('filelist.json 加载失败');
    const files = await response.json();

    // 2. 构建树形菜单
    buildTree(files, docTree);

    // 3. 默认展开第一项（如果它是目录）
    // const firstItem = docTree.querySelector('.tree-item');
    // if (firstItem && firstItem.nextElementSibling?.classList.contains('tree-children')) {
    //   toggleChildren(firstItem);
    // }

    // 4. 搜索功能
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      filterTree(term);
    });

  } catch (err) {
    docTree.innerHTML = `<li style="color: red; padding: 10px;">⚠️ ${err.message}</li>`;
    console.error(err);
  }

  // ========== 核心函数 ==========

  function buildTree(items, parentElement) {
    items.forEach(item => {
      const li = document.createElement('li');

      if (item.type === 'directory') {
        // 目录节点
        const div = document.createElement('div');
        div.className = 'tree-item';
        div.dataset.path = ''; // 目录不可点击渲染

        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle';
        toggle.textContent = '▶';
        div.appendChild(toggle);

        const title = document.createElement('span');
        title.textContent = beautifyName(item.name);
        div.appendChild(title);

        li.appendChild(div);

        // 创建子列表
        const childUl = document.createElement('ul');
        childUl.className = 'tree-children';
        li.appendChild(childUl);

        // 递归构建子树
        buildTree(item.children, childUl);

        // 绑定展开/折叠
        div.addEventListener('click', (e) => {
          if (e.target === toggle || e.target === div) {
            e.stopPropagation();
            toggleChildren(div);
          }
        });

      } else if (item.type === 'file') {
        // 文件节点
        const div = document.createElement('div');
        div.className = 'tree-item';
        div.dataset.file = item.path;

        const toggle = document.createElement('span');
        toggle.className = 'tree-toggle empty';
        div.appendChild(toggle);

        const title = document.createElement('span');
        title.textContent = beautifyName(item.name.replace(/\.md$/, ''));
        div.appendChild(title);

        li.appendChild(div);

        // 绑定点击加载
        div.addEventListener('click', () => {
          setActiveItem(div);
          loadMarkdown(item.path);
        });

        allNodes.push({ element: div, text: title.textContent });
      }

      parentElement.appendChild(li);
    });
  }

  function toggleChildren(itemElement) {
    const toggle = itemElement.querySelector('.tree-toggle');
    const children = itemElement.nextElementSibling;

    if (children && children.classList.contains('tree-children')) {
      const isShow = children.classList.toggle('show');
      toggle.textContent = isShow ? '▼' : '▶';
    }
  }

  function setActiveItem(item) {
    document.querySelectorAll('.tree-item').forEach(el => el.classList.remove('active'));
    item.classList.add('active');
  }

  async function loadMarkdown(filePath) {
    try {
      const response = await fetch(filePath);
      if (!response.ok) throw new Error(`加载失败: ${filePath}`);
      const text = await response.text();
      renderArea.innerHTML = marked.parse(text);
    } catch (err) {
      renderArea.innerHTML = `<p style="color: red;">⚠️ ${err.message}</p>`;
    }
  }

  function beautifyName(name) {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function filterTree(term) {
    if (!term) {
      // 显示所有
      document.querySelectorAll('.tree-children').forEach(el => {
        el.classList.remove('search-hidden');
        if (!el.classList.contains('show')) {
          el.style.display = 'none';
        } else {
          el.style.display = 'block';
        }
      });
      document.querySelectorAll('.tree-item').forEach(el => {
        el.style.display = '';
      });
      return;
    }

    // 隐藏所有
    document.querySelectorAll('.tree-item').forEach(el => {
      el.style.display = 'none';
    });

    // 显示匹配项 & 展开其路径
    allNodes.forEach(({ element, text }) => {
      if (text.toLowerCase().includes(term)) {
        element.style.display = '';
        // 展开父级
        let parent = element.closest('li');
        while (parent) {
          const children = parent.querySelector('.tree-children');
          if (children) {
            children.classList.add('show');
            children.style.display = 'block';
            const toggle = parent.querySelector('.tree-toggle');
            if (toggle) toggle.textContent = '▼';
          }
          parent = parent.parentElement?.closest('li');
        }
      }
    });
  }
});
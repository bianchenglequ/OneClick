// 公众号文章页面内容脚本

// 平台配置
const platforms = [
  { id: 'csdn', name: 'CSDN', icon: '💻', url: 'https://blog.csdn.net', dashboard: 'https://mp.csdn.net/mp_blog/manage/article' },
  { id: 'cnblogs', name: '博客园', icon: '📝', url: 'https://www.cnblogs.com', dashboard: 'https://i.cnblogs.com/posts?cfg=512' },
  { id: 'zhihu', name: '知乎', icon: '🧠', url: 'https://zhuanlan.zhihu.com/write', dashboard: 'https://www.zhihu.com/creator/manage/creation/all' },
  { id: 'toutiao', name: '今日头条', icon: '🚀', url: 'https://mp.toutiao.com', dashboard: 'https://mp.toutiao.com/profile_v4/manage/content/all' },


];

// 页面加载完成后执行
window.addEventListener('DOMContentLoaded', () => {
  checkAndInit();
});

// 监听URL变化
window.addEventListener('popstate', () => {
  checkAndInit();
});

// 定期检查（处理动态加载页面）
setInterval(() => {
  checkAndInit();
}, 500);



// 检查并初始化同步按钮
let isInitialized = false;
function checkAndInit() {
  // 检查是否在公众号文章页面
  const isWechatArticle = window.location.href.includes('mp.weixin.qq.com/s') && 
                         document.querySelector('#activity-name') !== null;
  
  // 如果是公众号文章页面且尚未初始化，则初始化同步按钮
  if (isWechatArticle && !isInitialized) {
    initSyncButton();
    isInitialized = true;
  } 
  // 如果不是公众号文章页面但已初始化，则清理
  else if (!isWechatArticle && isInitialized) {
    cleanupSyncButton();
    isInitialized = false;
  }
}

// 初始化同步按钮
function initSyncButton() {
  // 创建容器
  const container = document.createElement('div');
  container.className = 'sync-btn-container';
  
  // 创建主按钮
  const mainBtn = document.createElement('button');
  mainBtn.className = 'sync-main-btn';
  mainBtn.innerHTML = '<img src="' + chrome.runtime.getURL('images/logo.svg') + '" style="width: 16px; height: 16px; margin-right: 4px; vertical-align: middle;"> OneClick';
  
  // 创建平台选择面板
  const selector = createPlatformSelector();
  selector.style.display = 'none';
  
  // 点击按钮切换面板显示
  mainBtn.addEventListener('click', () => {
    selector.style.display = selector.style.display === 'none' ? 'block' : 'none';
  });
  
  // 添加到容器
  container.appendChild(mainBtn);
  container.appendChild(selector);
  
  // 添加到页面
  document.body.appendChild(container);
}

// 清理同步按钮
function cleanupSyncButton() {
  const container = document.querySelector('.sync-btn-container');
  if (container) {
    container.remove();
  }
}

// 创建平台选择面板
function createPlatformSelector() {
  const panel = document.createElement('div');
  panel.className = 'platform-selector';
  
  // 标题
  const title = document.createElement('h3');
  title.textContent = '选择同步平台';
  panel.appendChild(title);
  
  // 全选/取消全选控制
  const controlDiv = document.createElement('div');
  controlDiv.className = 'platform-controls';
  
  const toggleSelectBtn = document.createElement('button');
  toggleSelectBtn.className = 'control-btn';
  toggleSelectBtn.textContent = '全选';
  
  controlDiv.appendChild(toggleSelectBtn);
  panel.appendChild(controlDiv);
  
  // 切换全选/取消全选按钮事件
  toggleSelectBtn.addEventListener('click', () => {
    // 检查当前是否全部选中
    const allChecked = platforms.every(platform => {
      const checkbox = document.getElementById(`platform-${platform.id}`);
      return checkbox && checkbox.checked;
    });
    
    // 切换所有复选框的状态
    const newState = !allChecked;
    platforms.forEach(platform => {
      const checkbox = document.getElementById(`platform-${platform.id}`);
      if (checkbox) {
        checkbox.checked = newState;
      }
    });
    
    // 更新按钮文字
    toggleSelectBtn.textContent = newState ? '取消' : '全选';
    console.log(`🔄 已${newState ? '全选' : '取消选择'}所有平台`);
  });
  
  // 平台列表
  const platformList = document.createElement('ul');
  platformList.className = 'platform-list';
  
  platforms.forEach(platform => {
    const listItem = document.createElement('li');
    listItem.className = 'platform-item';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `platform-${platform.id}`;
    checkbox.checked = true; // 默认勾选所有平台
    
    const label = document.createElement('label');
    label.htmlFor = `platform-${platform.id}`;
    label.innerHTML = `<span>${platform.icon}</span>${platform.name}`;
    
    // 添加创作后台按钮
    const dashboardBtn = document.createElement('button');
    dashboardBtn.className = 'dashboard-btn';
    dashboardBtn.textContent = '后台';
    dashboardBtn.style.marginLeft = '10px';
    dashboardBtn.style.padding = '2px 6px';
    dashboardBtn.style.fontSize = '12px';
    dashboardBtn.style.border = '1px solid #ccc';
    dashboardBtn.style.borderRadius = '3px';
    dashboardBtn.style.backgroundColor = '#f0f0f0';
    dashboardBtn.style.cursor = 'pointer';
    
    // 创作后台按钮点击事件
    dashboardBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      window.open(platform.dashboard, '_blank');
    });
    
    // 为平台项添加点击事件，实现跳转功能
    listItem.addEventListener('click', (e) => {
      // 如果点击的是复选框、标签或创作后台按钮，不触发跳转
      if (e.target === checkbox || e.target === label || label.contains(e.target) || e.target === dashboardBtn) {
        return;
      }
      // 跳转到对应平台
      window.open(platform.url, '_blank');
    });
    
    listItem.appendChild(checkbox);
    listItem.appendChild(label);
    listItem.appendChild(dashboardBtn);
    platformList.appendChild(listItem);
  });
  
  panel.appendChild(platformList);
  
  // 同步按钮
  const syncBtn = document.createElement('button');
  syncBtn.className = 'sync-main-btn';
  syncBtn.style.width = '100%';
  syncBtn.style.marginTop = '15px';
  syncBtn.textContent = '开始同步';
  
  // 状态显示
  const statusDiv = document.createElement('div');
  statusDiv.className = 'sync-status';
  statusDiv.style.display = 'none';
  
  // 同步按钮点击事件
  syncBtn.addEventListener('click', () => {
    const selectedPlatforms = getSelectedPlatforms();
    if (selectedPlatforms.length === 0) {
      showStatus('请至少选择一个平台', 'error');
      return;
    }
    
    showStatus('开始同步...', '');
    syncToPlatforms(selectedPlatforms);
  });
  
  panel.appendChild(syncBtn);
  panel.appendChild(statusDiv);
  
  return panel;
}

// 获取选中的平台
function getSelectedPlatforms() {
  const selected = [];
  platforms.forEach(platform => {
    const checkbox = document.getElementById(`platform-${platform.id}`);
    if (checkbox && checkbox.checked) {
      selected.push(platform);
    }
  });
  return selected;
}

// 显示状态
function showStatus(message, type, details = null) {
  const statusDiv = document.querySelector('.sync-status');
  if (statusDiv) {
    let html = `<div class="status-message">${message}</div>`;
    
    // 如果有详细信息，显示成功和失败的平台列表（简化版本）
    if (details) {
      const { successPlatforms, failedPlatforms } = details;
      
      if (successPlatforms.length > 0) {
        html += `
          <div class="status-section success">
            <h4>成功平台:</h4>
            <ul>${successPlatforms.map(platform => `<li>${platform}</li>`).join('')}</ul>
          </div>
        `;
      }
      
      if (failedPlatforms.length > 0) {
        html += `
          <div class="status-section error">
            <h4>失败平台:</h4>
            <ul>${failedPlatforms.map(({platform}) => `<li>${platform}</li>`).join('')}</ul>
          </div>
        `;
      }
    }
    
    statusDiv.innerHTML = html;
    statusDiv.className = `sync-status ${type}`;
    statusDiv.style.display = 'block';
  }
}

// 同步状态跟踪器
let statusChecker = null;

// 开始跟踪同步状态
function startStatusTracking() {
  // 停止之前的跟踪
  stopStatusTracking();
  
  // 每秒查询一次状态
    statusChecker = setInterval(async () => {
      try {
        // 检查Chrome扩展API是否可用
        if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
          console.error('Chrome扩展API不可用，停止状态查询');
          stopStatusTracking();
          return;
        }
        
        const response = await chrome.runtime.sendMessage({
      action: 'getStatus'
    });
  
  if (response.success) {
    const { currentTask, completed, failed, total } = response.status;
    
    if (currentTask) {
      // 获取平台名称
      const platform = platforms.find(p => p.id === currentTask);
      const platformName = platform ? platform.name : currentTask;
      
      showStatus(`正在同步到 ${platformName}... (${completed}/${total})`, '');
    } else if (total > 0) {
      // 同步完成
      
      // 处理同步结果，获取成功和失败的平台列表
      const successPlatforms = [];
      const failedPlatforms = [];
      
      if (response.results) {
        response.results.forEach(result => {
          if (result.success) {
            successPlatforms.push(result.platform);
          } else {
            failedPlatforms.push({
              platform: result.platform,
              message: result.message
            });
          }
        });
      }
      
      if (failed === 0) {
        showStatus(`成功同步到 ${completed} 个平台！`, 'success', {
          successPlatforms,
          failedPlatforms
        });
      } else {
        showStatus(`同步完成：成功 ${completed} 个，失败 ${failed} 个`, 'error', {
          successPlatforms,
          failedPlatforms
        });
      }
      
      stopStatusTracking();
    }
      }
    } catch (error) {
      console.error('查询同步状态失败:', error);
      stopStatusTracking();
    }
  }, 1000);
}

// 停止跟踪同步状态
function stopStatusTracking() {
  if (statusChecker) {
    clearInterval(statusChecker);
    statusChecker = null;
  }
}

// 同步到平台的主函数
async function syncToPlatforms(selectedPlatforms) {
  try {
    // 获取文章内容
    const articleContent = extractArticleContent();
    
    // 检查文章内容是否有效
    if (!articleContent.title || !articleContent.content) {
      throw new Error('无法获取文章内容，请检查页面是否正确加载');
    }
    
    // 提取平台ID列表
    const platformIds = selectedPlatforms.map(platform => platform.id);
    
    // 发送到后台进行批量同步
    showStatus(`正在启动同步到 ${selectedPlatforms.length} 个平台...`, '');
    
    // 开始状态跟踪
    startStatusTracking();
    
    // 向后台发送同步请求
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      throw new Error('Chrome扩展API不可用，请检查扩展是否已正确加载');
    }
    
    const response = await chrome.runtime.sendMessage({
      action: 'startSync',
      platforms: platformIds,
      article: articleContent
    });
    
    // 如果同步立即完成（没有异步任务）
    if (response.success && response.status.total > 0 && response.status.currentTask === null) {
      stopStatusTracking();
      
      const { completed, failed } = response.status;
      
      // 处理同步结果
      const successPlatforms = [];
      const failedPlatforms = [];
      
      response.results.forEach(result => {
        if (result.success) {

          successPlatforms.push(result.platform);
        } else {
          failedPlatforms.push({
            platform: result.platform,
            message: result.message
          });
        }
      });
      
      // 显示详细结果
      if (failed === 0) {
        showStatus(`成功同步到 ${completed} 个平台！`, 'success', {
          successPlatforms,
          failedPlatforms
        });
      } else {
        showStatus(`同步完成：成功 ${completed} 个，失败 ${failed} 个`, 'error', {
          successPlatforms,
          failedPlatforms
        });
      }
    }
    
  } catch (error) {
    stopStatusTracking();
    console.error('同步过程中发生错误:', error);
    showStatus('同步失败：' + error.message, 'error');
  }
}

// 检查平台登录状态
async function checkLoginStatus(platformId) {
  try {
    // 检查Chrome扩展API是否可用
    if (!chrome || !chrome.runtime || !chrome.runtime.sendMessage) {
      console.error('Chrome扩展API不可用，无法检查登录状态');
      return false;
    }
    
    const response = await chrome.runtime.sendMessage({
      action: 'checkLogin',
      platform: platformId
    });
    
    return response.success && response.isLoggedIn;
  } catch (error) {
    console.error(`检查${platformId}登录状态失败:`, error);
    return false;
  }
}

// 提取公众号文章内容
function extractArticleContent() {
  // 获取标题
  const title = document.querySelector('#activity-name')?.textContent?.trim() || '';
  
  // 获取作者
  const author = document.querySelector('#js_name')?.textContent?.trim() || '';
  
  // 获取发布时间
  const publishTime = document.querySelector('#publish_time')?.textContent?.trim() || '';
  
  // 获取文章正文
  const content = document.querySelector('#js_content')?.innerHTML || '';
  
  return {
    title,
    author,
    publishTime,
    content,
    url: window.location.href
  };
}

// 同步到单个平台（返回平台ID用于批量同步）
async function syncToSinglePlatform(platformId, articleContent) {
  return { platform: platformId };
}

// 同步到CSDN
async function syncToCSDN(articleContent) {
  return { platform: 'csdn' };
}

// 同步到博客园
async function syncToCNBlogs(articleContent) {
  return { platform: 'cnblogs' };
}

// 同步到知乎
async function syncToZhihu(articleContent) {
  return { platform: 'zhihu' };
}

// 同步到今日头条
async function syncToToutiao(articleContent) {
  return { platform: 'toutiao' };
}





// 后台脚本，用于处理后台同步任务

// 同步任务队列
class SyncQueue {
  constructor() {
    this.queue = [];
    this.running = false;
  }
  
  // 添加任务到队列
  addTask(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject
      });
      this.runNext();
    });
  }
  
  // 运行下一个任务
  async runNext() {
    if (this.running || this.queue.length === 0) {
      return;
    }
    
    this.running = true;
    const { task, resolve, reject } = this.queue.shift();
    
    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running = false;
      this.runNext();
    }
  }
}

// 创建同步队列实例
const syncQueue = new SyncQueue();

// 存储同步状态
let syncStatus = {
  currentTask: null,
  completed: 0,
  failed: 0,
  total: 0
};

// 平台API配置
const platformApis = {
  csdn: {
    name: 'CSDN',
    // 使用CSDN新的API接口保存草稿
    uploadUrl: 'https://bizapi.csdn.net/blog-console-api/v3/mdeditor/saveArticle',
    loginCheckUrl: 'https://passport.csdn.net/login'
  },
  cnblogs: {
    name: '博客园',
    // 使用用户提供的API地址
    uploadUrl: 'https://i.cnblogs.com/api/posts',
    loginCheckUrl: 'https://www.cnblogs.com/ajax/blog/GetLoginStatus'
  },
  zhihu: {
    name: '知乎',
    uploadUrl: 'https://zhuanlan.zhihu.com/api/articles/drafts', // 修正为草稿API
    loginCheckUrl: 'https://www.zhihu.com/api/v4/me'
  },
  toutiao: {
    name: '今日头条',
    uploadUrl: 'https://mp.toutiao.com/mp/agw/article/publish',
    loginCheckUrl: 'https://mp.toutiao.com/api/author/get_user_info/'
  },


};

// 检查登录状态
async function checkLoginStatus(platformId) {
  const platform = platformApis[platformId];
  if (!platform) {
    console.error(`未找到平台：${platformId}`);
    return false;
  }
  
  try {
    // 优先使用platformApis中定义的loginCheckUrl
    console.log(`检查${platform.name}登录状态，使用URL: ${platform.loginCheckUrl}`);
    
    // 通用的API检查
    try {
      const apiResponse = await fetch(platform.loginCheckUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        }
      });
      
      console.log(`${platform.name}登录检查API响应:`, {
        status: apiResponse.status,
        ok: apiResponse.ok
      });
      
      if (apiResponse.ok) {
        // 尝试解析响应内容以进一步验证登录状态
        try {
          const apiData = await apiResponse.json();
          console.log(`${platform.name}登录检查API数据:`, apiData);
          
          // 根据平台特定规则验证登录状态
          switch (platformId) {
            case 'csdn':
              return apiData.status === 'login';
            case 'cnblogs':
              return apiData.IsLogin;
            case 'zhihu':
              return !!apiData.id;
            case 'toutiao':
              return !!apiData.user_info;

            default:
              return true;
          }
        } catch (e) {
          // 如果响应不是JSON格式，根据状态码判断
          console.log(`${platform.name}登录检查响应不是JSON，根据状态码判断登录状态`);
          return apiResponse.status === 200;
        }
      }
    } catch (e) {
      console.log(`${platform.name}登录检查API失败，尝试备用方案:`, e.message);
    }
    
    // 如果API检查失败，使用备用方案
    console.log(`使用备用方案检查${platform.name}登录状态`);
    switch (platformId) {
      case 'csdn':
        // CSDN: 访问文章编辑页面
        const csdnResponse = await fetch('https://editor.csdn.net/md/', {
          method: 'GET',
          credentials: 'include'
        });
        return csdnResponse.ok && csdnResponse.status === 200;
        
      case 'cnblogs':
        // 博客园: 访问个人主页
        const cnblogsResponse = await fetch('https://i.cnblogs.com/', {
          method: 'GET',
          credentials: 'include'
        });
        return cnblogsResponse.ok;
        
      case 'zhihu':
        // 知乎: 尝试访问写文章页面
        const zhihuEditorResponse = await fetch('https://zhuanlan.zhihu.com/write', {
          method: 'GET',
          credentials: 'include'
        });
        return zhihuEditorResponse.ok && zhihuEditorResponse.status !== 403;
        
      case 'toutiao':
        // 今日头条: 访问后台主页
        const toutiaoResponse = await fetch('https://mp.toutiao.com/', {
          method: 'GET',
          credentials: 'include'
        });
        return toutiaoResponse.ok && toutiaoResponse.status !== 302;
        

        
      default:
        // 默认情况下，尝试访问平台的主要页面
        const defaultResponse = await fetch(platform.uploadUrl, {
          method: 'GET',
          credentials: 'include'
        });
        return defaultResponse.ok;
    }
  } catch (error) {
    console.error(`检查${platform.name}登录状态失败:`, error);
    
    // 登录检查失败时，默认返回true，允许用户尝试同步
    // 实际同步时如果真的未登录，会在同步阶段失败
    console.warn(`${platform.name}登录检查失败，将尝试继续同步`);
    return true;
  }
}

// 同步到平台
async function syncToPlatform(platformId, article) {
  console.log(`\n=============================================`);
  console.log(`🚀 开始同步到 ${platformId}`);
  console.log(`📅 同步时间: ${new Date().toISOString()}`);
  console.log(`📄 文章信息:`, {
    title: article.title,
    contentLength: article.content.length,
    hasTitle: !!article.title,
    hasContent: !!article.content
  });
  
  const platform = platformApis[platformId];
  if (!platform) {
    const errorMsg = `未找到平台：${platformId}`;
    console.error(`❌ ${errorMsg}`);
    console.log(`=============================================\n`);
    return {
      success: false,
      platform: platformId,
      message: errorMsg
    };
  }
  
  console.log(`🔍 平台信息:`, {
    name: platform.name,
    uploadUrl: platform.uploadUrl,
    loginCheckUrl: platform.loginCheckUrl
  });
  
  // 检查登录状态
  console.log(`🔍 检查${platform.name}登录状态...`);
  const isLoggedIn = await checkLoginStatus(platformId);
  console.log(`🔐 ${platform.name}登录状态: ${isLoggedIn ? '✅ 已登录' : '❌ 未登录'}`);
  
  if (!isLoggedIn) {
    const errorMsg = `${platform.name} 未登录`;
    console.error(`❌ ${errorMsg}`);
    console.log(`=============================================\n`);
    return {
      success: false,
      platform: platform.name,
      message: errorMsg
    };
  }
  
  // 根据不同平台构建请求
  let requestOptions;
  
  try {
    console.log(`📝 开始构建${platform.name}请求...`);
    
    switch (platformId) {
      case 'csdn':
        requestOptions = await buildCSDNRequest(platform, article);
        break;
      case 'cnblogs':
        requestOptions = await buildCNBlogsRequest(platform, article);
        break;
      case 'zhihu':
        requestOptions = await buildZhihuRequest(platform, article);
        break;
      case 'toutiao':
        requestOptions = await buildToutiaoRequest(platform, article);
        break;

      default:
        const errorMsg = `未实现${platform.name}的同步请求构建`;
        console.error(`❌ ${errorMsg}`);
        console.log(`=============================================\n`);
        return {
          success: false,
          platform: platform.name,
          message: errorMsg
        };
    }
    
    // 检查请求构建是否成功
    if (!requestOptions) {
      const errorMsg = `${platform.name}请求构建失败`;
      console.error(`❌ ${errorMsg}`);
      console.log(`=============================================
`);
      return {
        success: false,
        platform: platform.name,
        message: errorMsg
      };
    }
    
    console.log(`✅ ${platform.name}请求构建成功`);
    console.log(`📋 请求详情:`, {
      url: requestOptions.url,
      method: requestOptions.method,
      headers: requestOptions.headers,
      requestType: requestOptions.requestType,
      bodyType: typeof requestOptions.body,
      bodyLength: requestOptions.body ? (typeof requestOptions.body === 'string' ? requestOptions.body.length : JSON.stringify(requestOptions.body).length) : 0
    });
    
    // 如果是iframe类型的请求，直接返回结果，由前端content.js处理
    if (requestOptions.requestType === 'iframe') {
      console.log(`🔄 发现iframe类型请求，返回处理指令给前端`);
      console.log(`=============================================
`);
      return {
        success: true,
        platform: platform.name,
        message: '请在新打开的B站编辑页面中完成同步',
        requestType: 'iframe',
        iframeUrl: requestOptions.url,
        article: requestOptions.article
      };
    }
    
    // 如果是表单数据，显示部分内容
    if (typeof requestOptions.body === 'string' && requestOptions.body.length < 1000) {
      console.log(`📤 请求体(完整):`, requestOptions.body);
    } else if (typeof requestOptions.body === 'object') {
      console.log(`📝 请求体(JSON):`, requestOptions.body);
    } else if (requestOptions.body) {
      console.log(`📝 请求体(部分):`, requestOptions.body.substring(0, 500) + '...');
    }
  } catch (error) {
    const errorMsg = `构建${platform.name}请求失败: ${error.message}`;
    console.error(`❌ ${errorMsg}`);
    console.error(`🔍 错误详情:`, error);
    console.log(`=============================================\n`);
    return {
      success: false,
      platform: platform.name,
      message: errorMsg
    };
  }
  
  // 发送请求
  try {
    console.log(`📤 准备发送请求到 ${platform.name}`);
    
    // 准备body数据，根据类型决定是否需要JSON.stringify
    const bodyData = typeof requestOptions.body === 'string' 
      ? requestOptions.body 
      : requestOptions.body ? JSON.stringify(requestOptions.body) : null;
    
    console.log(`� 请求发送详情:`, {
      url: requestOptions.url,
      method: requestOptions.method || 'POST',
      headers: requestOptions.headers,
      bodySize: bodyData ? bodyData.length : 0,
      withCredentials: true
    });
    
    // 显示实际发送的请求体部分内容
    if (bodyData && bodyData.length < 1000) {
      console.log(`📤 实际发送请求体(完整):`, bodyData);
    } else if (bodyData) {
      console.log(`📤 实际发送请求体(部分):`, bodyData.substring(0, 500) + '...');
    }
    
    // 添加超时处理（30秒）
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`请求超时（30秒）`)), 30000);
    });
    
    // 创建请求头，显式设置Origin为空字符串
    const requestHeaders = requestOptions.headers || {
      'Content-Type': 'application/json'
    };

    const response = await Promise.race([
      fetch(requestOptions.url, {
        method: requestOptions.method || 'POST',
        //credentials: 'include',
        headers: requestHeaders,
        body: bodyData,
        referrerPolicy: requestHeaders.referrerPolicy || 'no-referrer', // 防止发送Origin和Referer头
        mode: 'cors' // 使用cors模式
      }),
      timeoutPromise
    ]);
    
    console.log(`✅ 收到${platform.name}响应`);
    console.log(`📊 响应状态:`, {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    // 根据响应头判断内容类型，选择合适的解析方式
    const contentType = response.headers.get('content-type');
    console.log(`📋 响应头信息:`, {
      contentType: contentType,
      status: response.status,
      statusText: response.statusText
    });
    
    // 安全地获取响应头
    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });
    console.log(`📝 完整响应头:`, responseHeaders);
    
    // 安全地解析响应内容
    let data;
    console.log(`📦 开始解析${platform.name}响应内容`);
    
    if (contentType && contentType.includes('application/json')) {
      try {
        data = await response.json();
        console.log(`✅ ${platform.name} 响应内容解析为JSON成功`);
        console.log(`📄 JSON响应数据:`, data);
      } catch (e) {
        console.warn(`⚠️ ${platform.name} 响应不是有效的JSON，将以文本格式处理:`, e.message);
        data = await response.text();
        console.log(`� 文本响应数据:`, {
          length: data.length,
          content: data.length > 1000 ? data.substring(0, 1000) + '...' : data
        });
      }
    } else {
      data = await response.text();
      console.log(`� ${platform.name} 响应内容 (文本)`, {
        length: data.length,
        content: data.length > 1000 ? data.substring(0, 1000) + '...' : data
      });
      
      // 尝试将响应数据解析为JSON（适用于所有平台）
      if (typeof data === 'string' && (data.startsWith('{') || data.startsWith('['))) {
        try {
          console.log(`🔄 尝试将${platform.name}响应解析为JSON`);
          data = JSON.parse(data);
          console.log(`✅ ${platform.name}响应解析为JSON成功`, data);
        } catch (e) {
          // 解析失败保持文本格式
          console.warn(`⚠️ ${platform.name}响应不是有效的JSON:`, e.message);
        }
      }
    }
    
    // 检查响应状态码
    console.log(`🔍 检查${platform.name}响应状态码`);
    
    // 首先检查是否有errors字段（特别是博客园的重复保存错误）
    if (typeof data === 'object' && data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      console.error(`❌ ${platform.name} 返回错误信息:`, data.errors);
      console.log(`=============================================
`);
      
      // 针对博客园的"相同标题的博文已存在"错误，在前台显示"重复同步"
      if (platform.name === '博客园' && data.errors.some(error => error.includes('相同标题的博文已存在'))) {
        return {
          success: false,
          platform: platform.name,
          message: '同步重复',
          error: data,
          statusCode: response.status
        };
      }
      
      // 其他错误情况保持原始错误信息
      return {
        success: false,
        platform: platform.name,
        message: `同步到${platform.name}失败: ${data.errors.join('; ')}`,
        error: data,
        statusCode: response.status
      };
    }
    
    // 如果没有errors字段，再检查响应状态码
    if (!response.ok) {
      console.error(`❌ ${platform.name} 响应状态错误: HTTP ${response.status}`);
      console.error(`📄 错误响应数据:`, data);
      console.log(`=============================================\n`);
      return {
        success: false,
        platform: platform.name,
        message: `同步到${platform.name}失败: ${typeof data === 'object' ? data.message || data.error_msg || 'HTTP ' + response.status : data || 'HTTP ' + response.status}`,
        error: data,
        statusCode: response.status
      };
    }
    

    
    // 根据平台添加更严格的成功判断条件
    console.log(`🔍 根据平台逻辑判断${platform.name}同步是否成功`);
    const isSuccess = checkSyncSuccess(platformId, data);
    
    if (!isSuccess) {
      console.error(`❌ ${platform.name} 同步逻辑判断失败`);
      console.error(`📊 失败详情:`, { 
        data: data,
        isSuccess: isSuccess,
        platformId: platformId
      });
      console.log(`=============================================\n`);
      return {
        success: false,
        platform: platform.name,
        message: `${platform.name} 同步失败: 操作未成功`,
        error: data,
        statusCode: response.status
      };
    }
    
    console.log(`✅ ${platform.name} 同步成功！`);
    console.log(`🎉 同步结果:`, {
      platform: platform.name,
      statusCode: response.status,
      data: data
    });
    console.log(`=============================================\n`);
    
    return {
      success: true,
      platform: platform.name,
      message: `成功同步到${platform.name}`,
      data: data,
      statusCode: response.status
    };
  } catch (error) {
    console.error(`❌ 同步到${platform.name}失败:`);
    console.error(`📝 错误信息:`, error.message);
    console.error(`🔍 错误堆栈:`, error.stack);
    console.error(`📋 完整错误对象:`, error);
    console.log(`=============================================\n`);
    
    // 处理Extension context invalidated错误
    if (error.message.includes('Extension context invalidated')) {
      console.error('⚠️ 扩展上下文已失效，可能需要重新加载扩展');
      return {
        success: false,
        platform: platform.name,
        message: `同步到${platform.name}失败: 扩展上下文已失效，请重新加载扩展后重试`,
        error: error,
        stack: error.stack
      };
    }
    
    return {
      success: false,
      platform: platform.name,
      message: `同步到${platform.name}失败: ${error.message}`,
      error: error,
      stack: error.stack
    };
  }
}

// 检查同步是否真正成功
function checkSyncSuccess(platformId, data) {
  const platformName = platformApis[platformId]?.name || platformId;
  console.log(`🔍 检查${platformName}同步结果:`, { data });
  
  // 根据不同平台的API响应格式进行检查
  switch (platformId) {
    case 'csdn':
      // CSDN: 检查是否有success字段或error字段
      if (typeof data === 'object') {
        const success = data.success || !data.error;
        console.log(`📋 ${platformName}同步结果判断: ${success}`);
        return success;
      }
      // CSDN可能返回HTML，只要状态码200就认为成功
      console.log(`📋 ${platformName}返回非JSON数据，根据状态码判断为成功`);
      return true;
      
    case 'toutiao':
      // 今日头条: 检查返回码
      if (typeof data === 'object') {
        const success = data.code === 0 || data.err_no === 0;
        console.log(`📋 ${platformName}同步结果判断: ${success}`);
        return success;
      }
      console.log(`📋 ${platformName}返回非JSON数据，判断为失败`);
      return false;
      
    case 'juejin':
      // 掘金: 检查err_no
      if (typeof data === 'object') {
        const success = data.err_no === 0;
        console.log(`📋 ${platformName}同步结果判断: ${success}`);
        return success;
      }
      console.log(`📋 ${platformName}返回非JSON数据，判断为失败`);
      return false;
      
    case 'zhihu':
      // 知乎: 检查是否有id字段
      if (typeof data === 'object') {
        const success = !!data.id;
        console.log(`📋 ${platformName}同步结果判断: ${success}`);
        return success;
      }
      console.log(`📋 ${platformName}返回非JSON数据，判断为失败`);
      return false;
      
    case 'bilibili':
      // B站: 检查code
      if (typeof data === 'object') {
        const success = data.code === 0;
        console.log(`📋 ${platformName}同步结果判断: ${success}`);
        return success;
      }
      console.log(`📋 ${platformName}返回非JSON数据，判断为失败`);
      return false;
      
    case 'cnblogs':
      // 博客园: 检查是否有id字段
      if (typeof data === 'object') {
        // 根据用户提供的返回示例，成功时会包含id字段
        const success = !!data.id;
        console.log(`📋 ${platformName}同步结果判断: ${success}`);
        return success;
      }
      // 博客园可能重定向，只要状态码200就认为成功
      console.log(`📋 ${platformName}返回非JSON数据，根据状态码判断为成功`);
      return true;
      
    default:
      // 默认: 如果是对象且没有error字段，或者是成功的文本响应
      if (typeof data === 'object') {
        const success = !data.error && !data.errno && !data.code;
        console.log(`📋 ${platformName}默认同步结果判断: ${success}`);
        return success;
      }
      console.log(`📋 ${platformName}默认返回非JSON数据，判断为成功`);
      return true;
  }
}

// 将图片URL转换为base64格式
async function convertImageToBase64(imgUrl) {
  try {
    // 尝试下载图片
    const response = await fetch(imgUrl, {
      method: 'GET',
      mode: 'cors'
    });
    
    if (!response.ok) {
      throw new Error(`图片下载失败: ${response.status}`);
    }
    
    // 转换为Blob
    const blob = await response.blob();
    
    // 转换为base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`❌ 图片转换base64失败: ${imgUrl}`, error);
    return null; // 失败时返回null，后续会移除该图片
  }
}

// 将图片URL转换为base64格式
async function imageUrlToBase64(url) {
  try {
    console.log(`🔄 开始转换图片为base64: ${url}`);
    
    // 获取图片数据
    const response = await fetch(url, {
      mode: 'cors', // 允许跨域请求
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`获取图片失败: ${response.status} ${response.statusText}`);
    }
    
    // 将响应转换为Blob对象
    const blob = await response.blob();
    
    // 将Blob对象转换为base64编码
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log(`✅ 图片转换为base64成功: ${url}`);
        resolve(reader.result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error(`❌ 图片转换为base64失败: ${url}`);
    console.error(`📝 错误信息:`, error.message);
    return null; // 转换失败时返回null
  }
}

// 获取今日头条CSRF Token
async function getToutiaoCsrfToken() {
  try {
    console.log(`🔄 开始获取今日头条CSRF Token`);
    
    // 方法1: 尝试从Cookie中获取
    try {
      if (chrome && chrome.cookies && chrome.cookies.getAll) {
        const cookies = await chrome.cookies.getAll({url: 'https://mp.toutiao.com'});
        if (cookies && cookies.length > 0) {
          // 查找可能的CSRF Token相关Cookie
          const csrfCookie = cookies.find(c => 
            c.name.includes('csrf') || 
            c.name.includes('token') || 
            c.name === 'passport_csrf_token'
          );
          
          if (csrfCookie) {
            console.log(`✅ 从Cookie获取CSRF Token成功:`, csrfCookie.name);
            return csrfCookie.value;
          }
        }
      }
    } catch (e) {
      console.warn(`⚠️ 从Cookie获取CSRF Token失败:`, e.message);
    }
    
    // 方法2: 尝试发送一个请求来获取CSRF Token
    try {
      const response = await fetch('https://mp.toutiao.com/profile_v4/graphic/publish?from=toutiao_pc', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
        }
      });
      
      if (response.ok) {
        // 检查响应头中是否有CSRF Token
        const responseHeaders = response.headers;
        for (const [key, value] of responseHeaders.entries()) {
          if (key.toLowerCase().includes('csrf') || key.toLowerCase().includes('token')) {
            console.log(`✅ 从响应头获取CSRF Token成功:`, key);
            return value;
          }
        }
        
        // 尝试从响应内容中提取CSRF Token
        const html = await response.text();
        const csrfMatch = html.match(/x-secsdk-csrf-token\s*=\s*["']([^"']+)["']/);
        if (csrfMatch && csrfMatch[1]) {
          console.log(`✅ 从响应内容获取CSRF Token成功`);
          return csrfMatch[1];
        }
      }
    } catch (e) {
      console.warn(`⚠️ 从请求获取CSRF Token失败:`, e.message);
    }
    
    console.warn(`⚠️ 无法获取今日头条CSRF Token`);
    return null;
  } catch (error) {
    console.error(`❌ 获取今日头条CSRF Token失败:`, error.message);
    return null;
  }
}

// 获取今日头条发布页面的Header验证信息 - 简化版本，专注于获取Cookie
async function getToutiaoPublishHeaders() {
  try {
    console.log(`🔄 开始获取今日头条发布页面Header验证信息`);
    
    // 简化：直接使用chrome.cookies API获取完整Cookie
    let cookie = '';
    
    // 方法1: 优先使用chrome.cookies API获取完整Cookie
    try {
      console.log(`🔍 开始使用chrome.cookies API获取Cookie...`);
      if (chrome && chrome.cookies && chrome.cookies.getAll) {
        console.log(`✅ chrome.cookies API可用`);
        
        // 尝试获取mp.toutiao.com的Cookie
        const mpCookies = await chrome.cookies.getAll({url: 'https://mp.toutiao.com'});
        console.log(`📋 获取到的mp.toutiao.com Cookie:`, mpCookies ? mpCookies.length : 'null');
        console.log(`📝 所有mp.toutiao.com Cookie详情:`, mpCookies);
        
        // 尝试获取所有.toutiao.com的Cookie（包括子域名）
        const toutiaoCookies = await chrome.cookies.getAll({domain: '.toutiao.com'});
        console.log(`📋 获取到的.toutiao.com Cookie:`, toutiaoCookies ? toutiaoCookies.length : 'null');
        console.log(`📝 所有.toutiao.com Cookie详情:`, toutiaoCookies);
        
        // 合并所有Cookie，避免重复
        const allCookies = [...(mpCookies || []), ...(toutiaoCookies || [])];
        const uniqueCookies = [];
        const cookieNames = new Set();
        
        allCookies.forEach(c => {
          if (!cookieNames.has(c.name)) {
            cookieNames.add(c.name);
            uniqueCookies.push(c);
          }
        });
        
        if (uniqueCookies.length > 0) {
          cookie = uniqueCookies.map(c => `${c.name}=${c.value}`).join('; ');
          console.log(`✅ 合并后获取到完整Cookie (${uniqueCookies.length}个)`);
          console.log(`📝 Cookie内容: ${cookie.substring(0, 100)}...`); // 显示前100个字符
          console.log(`📏 Cookie总长度: ${cookie.length}字符`);
        } else {
          console.warn(`⚠️ 从浏览器Cookie存储获取到空Cookie列表`);
          console.warn(`📋 Cookie列表详细:`, allCookies);
        }
      } else {
        console.warn(`⚠️ chrome.cookies API不可用`);
        console.warn(`📋 chrome对象状态:`, {
          chrome: !!chrome,
          chromeCookies: !!chrome?.cookies,
          chromeCookiesGetAll: !!chrome?.cookies?.getAll
        });
      }
    } catch (e) {
      console.error(`❌ 从浏览器Cookie存储获取Cookie失败:`);
      console.error(`📝 错误信息:`, e.message);
      console.error(`📋 错误详情:`, e);
    }
    
    // 方法2: 如果没有获取到Cookie，尝试发送请求获取
    if (!cookie) {
      console.log(`🔄 开始尝试从发布页面获取Cookie...`);
      try {
        const publishUrl = 'https://mp.toutiao.com/profile_v4/graphic/publish?from=toutiao_pc';
        
        const response = await fetch(publishUrl, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
            'Origin': '' // 显式设置Origin为空字符串
          },
          referrerPolicy: 'no-referrer' // 防止浏览器添加Origin头
        });
        
        console.log(`📊 发布页面响应状态: ${response.status} ${response.statusText}`);
        
        // 尝试从响应头获取Cookie
        const setCookieHeaders = response.headers.getSetCookie();
        console.log(`📋 响应头中的set-cookie数量:`, setCookieHeaders ? setCookieHeaders.length : '0');
        
        if (setCookieHeaders && setCookieHeaders.length > 0) {
          cookie = setCookieHeaders.map(cookieString => {
            const cookieParts = cookieString.split(';');
            return cookieParts[0];
          }).join('; ');
          console.log(`✅ 从发布页面响应获取到Cookie (${setCookieHeaders.length}个)`);
          console.log(`📝 Cookie内容: ${cookie.substring(0, 100)}...`);
        } else {
          console.warn(`⚠️ 从发布页面响应头未获取到任何Cookie`);
        }
      } catch (e) {
        console.error(`❌ 从发布页面获取Cookie失败:`);
        console.error(`📝 错误信息:`, e.message);
        console.error(`📋 错误详情:`, e);
      }
    }
    
    // 构建基本请求头 - 只保留必要信息
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
    };
    
    // 核心：确保Cookie正确设置
    if (cookie) {
      headers['Cookie'] = cookie;
      console.log(`✅ 已将Cookie添加到返回的headers中`);
    } else {
      console.error(`❌ 未能获取到今日头条的任何Cookie，上传肯定会失败！`);
    }
    
    console.log(`✅ 成功获取今日头条发布页面Header验证信息`);
    console.log(`📝 获取到的验证信息:`, {
      'User-Agent': headers['User-Agent'],
      hasCookie: !!headers['Cookie'],
      cookieLength: headers['Cookie'] ? headers['Cookie'].length : 0
    });
    
    return headers;
  } catch (error) {
    console.error(`❌ 获取今日头条发布页面Header验证信息失败`);
    console.error(`📝 错误信息:`, error.message);
    console.error(`📋 错误详情:`, error);
    return null;
  }
}

// 上传图片到今日头条服务器
async function uploadImageToToutiao(imageUrl, headers) {
  try {
    console.log(`🔄 开始上传图片到今日头条: ${imageUrl}`);
    
    // 构建上传请求
    const uploadUrl = 'https://mp.toutiao.com/spice/image';
    
    // 构建完整的URL - 确保与示例完全一致
    const paramsString = 'upload_source=20020002&need_enhance=true&aid=1231&device_platform=web&scene=paste';
    const fullUrl = `${uploadUrl}?${paramsString}`;
    console.log(`📋 上传URL: ${fullUrl}`);
    
    // 检查传入的headers参数
    console.log(`🔍 传入的headers参数:`);
    console.log(`📋 headers存在: ${!!headers}`);
    console.log(`📋 headers类型: ${typeof headers}`);
    console.log(`📋 headers包含Cookie: ${!!(headers && headers['Cookie'])}`);
    console.log(`📋 headers内容:`, headers);
    
    // 构建表单数据 - 使用URLSearchParams确保application/x-www-form-urlencoded格式
    // 注意：确保imageUrl参数值被正确编码
    const formData = new URLSearchParams();
    formData.append('imageUrl', imageUrl); // URLSearchParams会自动编码参数值
    console.log(`📝 上传图片地址:`, imageUrl);
    console.log(`📝 编码后的表单数据:`, formData.toString());
    
    // 设置请求头 - 与成功请求报文保持一致
    const uploadHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Host': 'mp.toutiao.com' // 显式设置Host头
    };
    
    // 核心：确保Cookie正确传递 - 这是测试工具成功的关键
    if (headers && headers['Cookie']) {
      uploadHeaders['Cookie'] = headers['Cookie'];
      console.log(`✅ 已将Cookie添加到上传请求头中`);
      console.log(`📏 Cookie长度: ${headers['Cookie'].length}字符`);
      console.log(`📝 Cookie前100字符: ${headers['Cookie'].substring(0, 100)}...`);
    } else {
      console.error(`❌ 传入的headers参数中没有Cookie！`);
      console.error(`📋 详细信息:`, {
        headersExists: !!headers,
        headersHasCookie: !!headers?.['Cookie']
      });
    }
    
    // 记录请求头信息 - 显示完整的请求头
    console.log(`📝 上传请求头:`, uploadHeaders);
    console.log(`📋 上传请求头包含Cookie: ${!!uploadHeaders['Cookie']}`);
    
    // 发送上传请求 - 使用fetch API
    console.log(`📋 上传请求配置:`, {
      method: 'POST',
      headers: uploadHeaders,
      bodyType: formData.constructor.name
    });
    
    // 使用fetch API发送请求
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData.toString(), // 直接使用字符串形式的表单数据
      referrerPolicy: 'no-referrer', // 防止发送Origin和Referer头
      mode: 'cors' // 使用cors模式
    });
    
    // 记录响应状态和响应头
    console.log(`📊 上传响应状态: ${response.status} ${response.statusText}`);
    console.log(`📊 上传响应头:`, response.headers);
    
    if (!response.ok) {
      // 尝试获取响应内容，用于更详细的错误分析
      try {
        const errorResponse = await response.text();
        console.error(`❌ 图片上传失败详细响应:`, errorResponse);
        throw new Error(`图片上传失败: ${response.status} ${response.statusText}\n响应内容: ${errorResponse}`);
      } catch (e) {
        // 如果无法解析响应内容，使用基本错误信息
        throw new Error(`图片上传失败: ${response.status} ${response.statusText}`);
      }
    }
    
    // 解析响应数据
    const responseData = await response.json();
    
    // 检查响应是否成功
    if (responseData.code === 0) {
      console.log(`✅ 图片上传成功: ${imageUrl}`);
      console.log(`📝 上传响应:`, responseData);
      return responseData;
    } else {
      console.error(`❌ 图片上传到今日头条失败: ${imageUrl}`);
      console.error(`📝 错误信息:`, responseData.message);
      console.error(`📝 错误码:`, responseData.code);
      console.error(`📝 错误响应:`, responseData);
      return responseData; // 上传失败时也返回响应数据，用于后续处理
    }
  } catch (error) {
    console.error(`❌ 图片上传到今日头条失败: ${imageUrl}`);
    console.error(`📝 错误信息:`, error.message);
    console.error(`📝 错误详情:`, error);
    return null; // 网络错误时返回null
  }
}

// HTML到Markdown的转换函数
function htmlToMarkdown(html) {
  if (!html) return '';
  
  let markdown = html;
  
  // 首先保留所有换行符
  markdown = markdown.replace(/<br[^>]*\/?>/gi, '\n');
  markdown = markdown.replace(/<br\s*\/>/gi, '\n');
  
  // 处理标题
  markdown = markdown.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '#### $1\n\n');
  markdown = markdown.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, '##### $1\n\n');
  markdown = markdown.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, '###### $1\n\n');
  
  // 处理段落
  markdown = markdown.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  
  // 处理加粗
  markdown = markdown.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  
  // 处理斜体
  markdown = markdown.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  
  // 处理删除线
  markdown = markdown.replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, '~~$1~~');
  
  // 处理链接
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  
  // 处理无序列表
  markdown = markdown.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(match, content) {
    // 处理列表项
    content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
    return content + '\n';
  });
  
  // 处理有序列表
  markdown = markdown.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function(match, content) {
    let index = 1;
    // 处理列表项
    content = content.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function(match, item) {
      return `${index++}. ${item}\n`;
    });
    return content + '\n';
  });
  
  // 处理代码块
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```\n$1\n```\n\n');
  
  // 处理行内代码
  markdown = markdown.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  
  // 处理引用
  markdown = markdown.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');
  
  // 处理图片（转换为Markdown图片格式）
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)');
  
  // 处理水平线
  markdown = markdown.replace(/<hr[^>]*>/gi, '---\n\n');
  
  // 移除所有其他HTML标签
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  // 移除多余的空行，确保每个段落之间有两个换行符
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  // 确保单个换行符变为两个换行符，以兼容不同平台
  markdown = markdown.replace(/(?<!\n)\n(?!\n)/g, '\n\n');
  
  // 处理特殊字符
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&quot;/g, '"');
  markdown = markdown.replace(/&#39;/g, "'");
  
  return markdown.trim();
}

// 优化的内容处理函数，包括图片处理和HTML到Markdown的转换
async function processImagesInContent(content) {
  console.log(`📋 开始处理文章内容`);
  
  if (!content) {
    console.log(`⚠️ 原始内容为空，返回默认内容`);
    return '无内容';
  }
  
  console.log(`📊 原始内容长度: ${content.length}`);
  console.log(`📊 原始内容包含<img>标签数: ${(content.match(/<img[^>]+>/g) || []).length}`);
  
  // 替换图片标签为base64格式
  let processedContent = content;
  
  // 更强大的图片标签匹配正则，支持各种格式
  const imgRegex = /<img[^>]*>/gi;
  let imgMatches = processedContent.match(imgRegex) || [];
  console.log(`🔍 匹配到的图片标签数: ${imgMatches.length}`);
  
  if (imgMatches.length > 0) {
    // 显示前3个图片标签示例
    for (let i = 0; i < Math.min(3, imgMatches.length); i++) {
      console.log(`📝 图片标签示例 ${i+1}: ${imgMatches[i]}`);
    }
    
    // 逐个转换图片为base64
    console.log(`🔄 开始将图片转换为base64格式...`);
    let convertedCount = 0;
    let failedCount = 0;
    
    for (let imgTag of imgMatches) {
      // 提取图片URL
      const srcMatch = imgTag.match(/src="([^"]*)"/i);
      if (srcMatch && srcMatch[1]) {
        const imgUrl = srcMatch[1];
        
        // 转换图片为base64
        const base64Data = await imageUrlToBase64(imgUrl);
        
        if (base64Data) {
          // 替换图片标签中的src为base64数据
          processedContent = processedContent.replace(imgTag, imgTag.replace(imgUrl, base64Data));
          convertedCount++;
        } else {
          console.warn(`⚠️ 跳过转换失败的图片: ${imgUrl}`);
          failedCount++;
        }
      }
    }
    
    console.log(`✅ 图片转换完成: ${convertedCount}张成功, ${failedCount}张失败`);
  } else {
    console.log(`ℹ️ 未找到任何图片标签`);
  }
  
  // 将HTML转换为Markdown，包括图片
  console.log(`🔄 将HTML转换为Markdown格式（包含图片）`);
  const markdownContent = htmlToMarkdown(processedContent);
  console.log(`📊 Markdown转换完成: 转换后内容长度 ${markdownContent.length}`);
  
  // 如果处理后内容为空，添加默认内容
  if (markdownContent.trim().length === 0) {
    console.log(`⚠️ 处理后内容为空，添加默认内容`);
    return '无内容';
  }
  
  return markdownContent;
}

// 构建各个平台的请求
async function buildCSDNRequest(platform, article) {
  // 使用CSDN新的API接口保存草稿
  // 请求体为JSON格式
  
  // 1. 先访问CSDN编辑器页面获取必要的头部信息
  let csdnHeaders = {};
  try {
    console.log('🔍 正在访问CSDN编辑器页面获取头部信息...');
    const editorResponse = await fetch('https://editor.csdn.net/md', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      }
    });
    
    console.log('📊 CSDN编辑器页面响应状态:', editorResponse.status);
    
    // 从响应头中提取X-Ca-Key等必要信息
    if (editorResponse.headers.has('X-Ca-Key')) {
      csdnHeaders['X-Ca-Key'] = editorResponse.headers.get('X-Ca-Key');
      console.log('✅ 成功获取X-Ca-Key:', csdnHeaders['X-Ca-Key']);
    }
    
    // 提取其他可能需要的头部信息
    if (editorResponse.headers.has('X-Ca-Timestamp')) {
      csdnHeaders['X-Ca-Timestamp'] = editorResponse.headers.get('X-Ca-Timestamp');
    }
    if (editorResponse.headers.has('X-Ca-Signature')) {
      csdnHeaders['X-Ca-Signature'] = editorResponse.headers.get('X-Ca-Signature');
    }
    if (editorResponse.headers.has('X-Ca-Signature-Headers')) {
      csdnHeaders['X-Ca-Signature-Headers'] = editorResponse.headers.get('X-Ca-Signature-Headers');
    }
    if (editorResponse.headers.has('X-Ca-Nonce')) {
      csdnHeaders['X-Ca-Nonce'] = editorResponse.headers.get('X-Ca-Nonce');
    }
  } catch (error) {
    console.warn('⚠️ 访问CSDN编辑器页面获取头部信息失败:', error);
  }
  
  // 处理文章内容，将HTML转换为Markdown格式（不转换图片为base64）
  const markdownContent = htmlToMarkdown(article.content);
  
  // 构建JSON请求体
  const requestData = {
    title: article.title,
    markdowncontent: markdownContent,
    content: article.content,
    readType: 'public',
    level: 0,
    tags: '公众号文章',
    status: 2, // 2表示草稿
    categories: '',
    type: 'original', // 原创
    original_link: '',
    authorized_status: false,
    not_auto_saved: '1',
    source: 'pc_mdeditor',
    cover_images: [],
    cover_type: 1,
    is_new: 1,
    vote_id: 0,
    resource_id: '',
    pubStatus: 'draft', // 草稿状态
    creator_activity_id: ''
  };
  
  // 请求头信息
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Referer': 'https://editor.csdn.net/md/',
    'Origin': 'https://editor.csdn.net',
    // CSDN API所需的认证头部信息
    'x-ca-key': '203803574',
    'x-ca-nonce': 'ff42a510-aba6-4369-8290-ef38802c776a',
    'x-ca-signature': 'E+bbKANPNt7fnppa17w2DZlKD8s+vHMvHNUM2tuUtuM=',
    'x-ca-signature-headers': 'x-ca-key,x-ca-nonce'
  };
  
  return {
    url: platform.uploadUrl,
    method: 'POST',
    headers: headers,
    body: JSON.stringify(requestData)
  };
}

async function buildCNBlogsRequest(platform, article) {
  console.log('🔍 使用博客园API保存草稿...');
  
  // 1. 先访问博客园编辑页面获取必要的cookie和x-xsrf-token
  let cnblogsHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Referer': 'https://i.cnblogs.com/posts/edit',
    'Origin': 'https://i.cnblogs.com',
    'Accept': 'application/json, text/plain, */*'
  };
  
  try {
    console.log('🔍 正在访问博客园编辑页面获取cookie和x-xsrf-token...');
    
    // 首先使用fetch访问博客园编辑页面，确保cookie被正确设置
    const editPageResponse = await fetch('https://i.cnblogs.com/posts/edit', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36'
      }
    });
    
    console.log('📊 博客园编辑页面响应状态:', editPageResponse.status);
    
    // 从响应的Set-Cookie头中提取必要的cookie
    const setCookieHeaders = editPageResponse.headers.get('set-cookie') || '';
    if (setCookieHeaders) {
      console.log('📝 Set-Cookie头:', setCookieHeaders);
      
      // 尝试从Set-Cookie头中提取XSRF-TOKEN
      const xsrfTokenMatch = setCookieHeaders.match(/XSRF-TOKEN=([^;]+)/i);
      if (xsrfTokenMatch && xsrfTokenMatch[1]) {
        // 解码URL编码的token
        const xsrfToken = decodeURIComponent(xsrfTokenMatch[1]);
        cnblogsHeaders['x-xsrf-token'] = xsrfToken;
        console.log('✅ 从Set-Cookie中成功获取x-xsrf-token:', xsrfToken);
      }
    }
    
    // 如果从Set-Cookie中没有获取到x-xsrf-token，尝试获取完整的页面内容
    if (!cnblogsHeaders['x-xsrf-token'] && editPageResponse.ok) {
      const pageContent = await editPageResponse.text();
      
      // 尝试从页面内容中提取x-xsrf-token
      const metaTokenMatch = pageContent.match(/<meta\s+name="XSRF-TOKEN"\s+content="([^"]+)"\s*>/i);
      if (metaTokenMatch && metaTokenMatch[1]) {
        cnblogsHeaders['x-xsrf-token'] = metaTokenMatch[1];
        console.log('✅ 从页面meta标签中成功获取x-xsrf-token:', metaTokenMatch[1]);
      }
      
      // 尝试从页面JavaScript变量中提取x-xsrf-token
      const scriptTokenMatch = pageContent.match(/XSRF-TOKEN\s*=\s*['"]([^'"]+)['"]/i);
      if (!cnblogsHeaders['x-xsrf-token'] && scriptTokenMatch && scriptTokenMatch[1]) {
        cnblogsHeaders['x-xsrf-token'] = scriptTokenMatch[1];
        console.log('✅ 从页面JavaScript中成功获取x-xsrf-token:', scriptTokenMatch[1]);
      }
    }
    
    // 如果还是没有获取到x-xsrf-token，尝试使用chrome.cookies API获取
    if (!cnblogsHeaders['x-xsrf-token'] && typeof chrome !== 'undefined' && chrome.cookies) {
      try {
        const cookie = await new Promise((resolve) => {
          chrome.cookies.get({url: 'https://i.cnblogs.com', name: 'XSRF-TOKEN'}, resolve);
        });
        
        if (cookie && cookie.value) {
          // 解码URL编码的token
          const xsrfToken = decodeURIComponent(cookie.value);
          cnblogsHeaders['x-xsrf-token'] = xsrfToken;
          console.log('✅ 从chrome.cookies API中成功获取x-xsrf-token:', xsrfToken);
        }
      } catch (error) {
        console.warn('⚠️ 使用chrome.cookies API获取x-xsrf-token失败:', error);
      }
    }
    
  } catch (error) {
    console.warn('⚠️ 访问博客园编辑页面获取信息失败:', error);
  }
  
  // 2. 处理文章内容，将HTML转换为Markdown格式（不转换图片为base64）
  const content = htmlToMarkdown(article.content);
  
  // 3. 根据用户提供的示例，构建完整的JSON请求体
  const requestData = {
    id: null,
    postType: 1,
    accessPermission: 0,
    title: article.title,
    url: null,
    postBody: content, // 处理后的Markdown内容
    categoryIds: null,
    categories: null,
    collectionIds: [],
    inSiteCandidate: false,
    inSiteHome: false,
    siteCategoryId: null,
    blogTeamIds: null,
    isPublished: false,
    displayOnHomePage: true,
    isAllowComments: true,
    includeInMainSyndication: true,
    isPinned: false,
    showBodyWhenPinned: false,
    isOnlyForRegisterUser: false,
    isUpdateDateAdded: false,
    entryName: null,
    description: content.substring(0, 200) + '...', // 文章摘要
    featuredImage: null,
    tags: null,
    password: null,
    publishAt: null,
    datePublished: new Date().toISOString(), // 当前时间
    dateUpdated: null,
    isMarkdown: true,
    isDraft: true, // 草稿状态
    autoDesc: null,
    changePostType: false,
    blogId: 0,
    author: null,
    removeScript: false,
    clientInfo: null,
    changeCreatedTime: false,
    canChangeCreatedTime: false,
    isContributeToImpressiveBugActivity: false,
    usingEditorId: 6, // Markdown编辑器
    sourceUrl: null
  };
  
  return {
    url: platform.uploadUrl,
    method: 'POST',
    headers: cnblogsHeaders,
    body: JSON.stringify(requestData),
    credentials: 'include' // 包含cookie信息
  };
}

async function buildZhihuRequest(platform, article) {
  // 处理文章内容，将HTML转换为Markdown格式
  const content = await processImagesInContent(article.content);
  
  return {
    url: platform.uploadUrl,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://zhuanlan.zhihu.com/write'
    },
    body: {
      title: article.title,
      content: content,
      excerpt: content.substring(0, 200) + '...',
      topics: [19552667], // 技术话题ID
      column: null,
      draft: true // 保存为草稿
    }
  };
}

async function buildToutiaoRequest(platform, article) {
  console.log('🔍 使用今日头条API发布...');
  
  // 1. 进入发布页面，获取Header验证信息
  console.log(`🔄 开始获取今日头条发布页面Header验证信息...`);
  const publishHeaders = await getToutiaoPublishHeaders();
  
  if (!publishHeaders) {
    console.error(`❌ 获取Header验证信息失败，无法继续发布`);
    return null;
  }
  
  // 处理标题长度，确保在2-30字之间
  let title = article.title || '无标题';
  
  // 2. 处理文章内容，使用获取到的Header验证信息上传图片
  console.log(`📋 开始处理今日头条文章内容（富文本）`);
  
  let content = article.content;
  if (!content) {
    console.log(`⚠️ 原始内容为空，返回默认内容`);
    content = '无内容';
  } else {
    let processedContent = content;
    
    // 提取并上传所有图片
    const imgRegex = /<img[^>]*>/gi;
    const imgMatches = processedContent.match(imgRegex) || [];
    
    console.log(`📊 原始内容长度: ${content.length}`);
    console.log(`📊 发现的图片标签数: ${imgMatches.length}`);
    
    if (imgMatches.length > 0) {
      // 逐个上传图片
      console.log(`🔄 开始上传图片到今日头条服务器...`);
      let uploadedCount = 0;
      let failedCount = 0;
      
      // 创建一个新的处理内容，用于累积修改
      let newContent = processedContent;
      
      // 遍历所有图片标签
      for (let imgTag of imgMatches) {
        // 提取图片URL（优先使用src属性, src标签空格避免匹配到data-src）
        let imgUrl;
        const dataSrcMatch = imgTag.match(/ data-src="([^"]*)"/i);
        const srcMatch = imgTag.match(/ src="([^"]*)"/i);
        
        if (srcMatch && srcMatch[1]) {
          imgUrl = srcMatch[1];
        } else if (dataSrcMatch && dataSrcMatch[1]) {
          imgUrl = dataSrcMatch[1];
        }
        
        if (imgUrl) {
          // 使用获取到的Header验证信息上传图片
          const uploadResult = await uploadImageToToutiao(imgUrl, publishHeaders);
          
          if (uploadResult) {
            // 检查上传是否成功
            if (uploadResult.code === 0) {
              // 上传成功，替换图片URL
              if (uploadResult.data && uploadResult.data.image_url) {
                // 移除image_url中的反引号
                const imageUrl = uploadResult.data.image_url.replace(/[`]/g, '').trim();
                // 转义imgUrl中的特殊字符以创建有效的正则表达式
                const escapedImgUrl = imgUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // 替换当前图片标签中的URL
                const updatedImgTag = imgTag.replace(new RegExp(escapedImgUrl, 'g'), imageUrl);
                // 转义当前图片标签中的特殊字符以创建有效的正则表达式
                const escapedImgTag = imgTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // 使用新的图片标签替换旧的
                newContent = newContent.replace(new RegExp(escapedImgTag, 'g'), updatedImgTag);
                uploadedCount++;
              } else {
                console.warn(`⚠️ 无法提取上传后的图片URL:`, uploadResult);
                // 无法提取URL，删除图片标签
                const escapedImgTag = imgTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                newContent = newContent.replace(new RegExp(escapedImgTag, 'g'), '');
                failedCount++;
              }
            } else {
              // 上传失败，删除图片标签
              console.warn(`⚠️ 图片上传失败，错误码: ${uploadResult.code}, 错误信息: ${uploadResult.message}`);
              const escapedImgTag = imgTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              newContent = newContent.replace(new RegExp(escapedImgTag, 'g'), '');
              failedCount++;
            }
          } else {
            // 网络错误等其他情况，删除图片标签
            console.warn(`⚠️ 图片上传网络错误: ${imgUrl}`);
            const escapedImgTag = imgTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            newContent = newContent.replace(new RegExp(escapedImgTag, 'g'), '');
            failedCount++;
          }
        } else {
          // 没有找到图片URL，删除图片标签
          console.warn(`⚠️ 无法从图片标签提取URL:`, imgTag);
          const escapedImgTag = imgTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          newContent = newContent.replace(new RegExp(escapedImgTag, 'g'), '');
          failedCount++;
        }
      }
      
      // 更新处理后的内容
      processedContent = newContent;
      
      console.log(`✅ 图片上传完成: ${uploadedCount}张成功, ${failedCount}张失败`);
    }
    
    // 如果处理后内容为空，添加默认内容
    if (processedContent.trim().length === 0) {
      console.log(`⚠️ 处理后内容为空，添加默认内容`);
      processedContent = '无内容';
    }
    
    content = processedContent;
  }
  
  console.log(`📋 开始构建今日头条表单数据`);
  console.log(`📝 处理后的标题: ${title} (长度: ${title.length})`);
  console.log(`📝 处理后的内容长度: ${content.length}`);
  console.log(`📝 内容是否为HTML格式: ${content.includes('<') && content.includes('>')}`);
  
  // 3. 使用今日头条的表单提交API上传文章，使用获取到的Header验证信息
  const formData = new URLSearchParams();
  formData.append('article_type', '0'); // 文章类型
  formData.append('source', '29'); // 来源
  formData.append('content', content); // 处理后的富文本文章内容
  formData.append('title', title); // 处理后的文章标题
  formData.append('save', '0'); // 0表示保存为草稿
  formData.append('publish_type', '0'); // 0表示保存为草稿，1表示发布
  formData.append('is_publish', '0'); // 0表示不发布，1表示发布
  formData.append('draft_form_data', JSON.stringify({"coverType":0})); // 0表示无封面
  formData.append('pgc_feed_covers', '[]'); // 空封面列表
  
  // 仅添加必要的额外参数
  formData.append('extra', JSON.stringify({
    "content_source": 100000000402,
    "content_word_cnt": content.length,
    "is_multi_title": 0,
    "sub_titles": [],
    "gd_ext": {
      "entrance": "",
      "from_page": "publisher_mp",
      "enter_from": "PC",
      "device_platform": "mp",
      "is_message": 0
    },
    "tuwen_wtt_transfer_switch": "0"
  }));
  
  // 添加基本的必填字段
  formData.append('search_creation_info', JSON.stringify({"searchTopOne":0,"abstract":"","clue_id":""}));
  formData.append('title_id', Date.now() + '_' + Math.floor(Math.random() * 10000000000000000));
  formData.append('mp_editor_stat', '{}');
  
  // 3. 使用获取到的Header验证信息发布文章
  return {
    url: platform.uploadUrl,
    method: 'POST',
    headers: {
      ...publishHeaders, // 使用获取到的Header验证信息
      'Content-Type': 'application/x-www-form-urlencoded', // 添加表单内容类型
      'Origin': '' // 显式设置Origin为空字符串，覆盖浏览器自动添加的Origin头
    },
    body: formData.toString()
  };
}

// 从Cookie中获取掘金的uuid
async function getJuejinUuid() {
  try {
    return new Promise((resolve) => {
      chrome.cookies.get({
        url: 'https://juejin.cn',
        name: '__tea_cookie_tokens_2608'
      }, (cookie) => {
        if (cookie) {
          try {
            const cookieData = JSON.parse(decodeURIComponent(cookie.value));
            resolve(cookieData.user_unique_id || cookieData.web_id);
          } catch (e) {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });
  } catch (e) {
    console.error('获取掘金UUID失败:', e);
    return null;
  }
}

// 生成随机的文章ID（用于新草稿）
function generateArticleId() {
  return Date.now().toString() + Math.floor(Math.random() * 1000).toString();
}






// 执行批量同步
async function batchSync(platforms, article) {
  console.log(`\n=============================================`);
  console.log(`🚀 开始批量同步任务`);
  console.log(`📅 开始时间: ${new Date().toISOString()}`);
  console.log(`📊 同步计划:`, {
    totalPlatforms: platforms.length,
    platforms: platforms,
    articleTitle: article.title,
    articleContentLength: article.content.length
  });
  
  syncStatus = {
    currentTask: null,
    completed: 0,
    failed: 0,
    total: platforms.length,
    startTime: new Date().toISOString(),
    platforms: platforms
  };
  
  const results = [];
  
  console.log(`📋 开始按顺序同步到各个平台...`);
  
  for (let i = 0; i < platforms.length; i++) {
    const platformId = platforms[i];
    const platform = platformApis[platformId];
    const platformName = platform?.name || platformId;
    
    console.log(`\n🔄 [${i + 1}/${platforms.length}] 准备同步到 ${platformName}`);
    syncStatus.currentTask = platformId;
    
    try {
      console.log(`📌 ${platformName} 开始同步...`);
      const result = await syncQueue.addTask(() => syncToPlatform(platformId, article));
      results.push(result);
      
      if (result.success) {
        syncStatus.completed++;
        console.log(`✅ ${platformName} 同步成功`);
        console.log(`📊 当前进度: ${syncStatus.completed}/${syncStatus.total} 成功, ${syncStatus.failed} 失败`);
      } else {
        syncStatus.failed++;
        console.log(`❌ ${platformName} 同步失败`);
        console.log(`📝 失败原因: ${result.message}`);
        console.log(`📊 当前进度: ${syncStatus.completed}/${syncStatus.total} 成功, ${syncStatus.failed} 失败`);
      }
    } catch (error) {
      const errorMsg = error.message || '未知错误';
      results.push({
        success: false,
        platform: platformName,
        message: errorMsg,
        error: error
      });
      syncStatus.failed++;
      console.error(`❌ ${platformName} 同步过程中发生未捕获错误:`);
      console.error(`📝 错误信息:`, errorMsg);
      console.error(`🔍 完整错误:`, error);
      console.log(`📊 当前进度: ${syncStatus.completed}/${syncStatus.total} 成功, ${syncStatus.failed} 失败`);
    }
  }
  
  syncStatus.currentTask = null;
  syncStatus.endTime = new Date().toISOString();
  syncStatus.results = results; // 添加同步结果数组
  
  console.log(`
=============================================`);
  console.log(`🎉 批量同步任务完成！`);
  console.log(`📅 结束时间: ${syncStatus.endTime}`);
  console.log(`📊 最终结果:`, {
    总平台数: syncStatus.total,
    成功数: syncStatus.completed,
    失败数: syncStatus.failed,
    成功率: `${Math.round((syncStatus.completed / syncStatus.total) * 100)}%`
  });
  
  // 显示每个平台的详细结果
  console.log(`\n📋 各平台同步详情:`);
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const platformName = result.platform;
    console.log(`${status} ${index + 1}. ${platformName}: ${result.message}`);
    if (!result.success && result.error) {
      console.log(`   📝 详细错误:`, result.error);
    }
  });
  
  console.log(`=============================================\n`);
  
  return results;
}

// 监听来自内容脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'startSync':
      // 开始同步任务
      syncStatus = {
        currentTask: null,
        completed: 0,
        failed: 0,
        total: message.platforms.length
      };
      
      batchSync(message.platforms, message.article)
        .then(results => {
          sendResponse({
            success: true,
            results,
            status: syncStatus
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            message: error.message,
            status: syncStatus
          });
        });
      break;
      
    case 'getStatus':
      // 返回同步状态
      sendResponse({
        success: true,
        status: syncStatus
      });
      break;
      
    case 'checkLogin':
      // 检查登录状态
      checkLoginStatus(message.platform)
        .then(isLoggedIn => {
          sendResponse({
            success: true,
            isLoggedIn,
            platform: message.platform
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            message: error.message
          });
        });
      break;
      
    default:
      sendResponse({ success: false, message: '未知操作' });
  }
  
  return true; // 保持消息通道开放
});

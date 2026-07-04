export default defineBackground(() => {
  // 禁用全局默认面板，避免未点击的标签页也显示
  browser.sidePanel.setOptions({ enabled: false }).catch(console.error);

  // 点击插件图标时，只为当前标签页启用并打开侧边栏
  browser.action.onClicked.addListener((tab) => {
    if (tab.id == null) return;
    const tabId = tab.id;

    // 先同步启用当前标签页的面板
    browser.sidePanel.setOptions({
      tabId,
      path: '/sidepanel.html',
      enabled: true,
    });

    // sidePanel.open() 必须在用户手势回调中同步调用；
    // 如果前面加了 await/setTimeout/回调，Chrome 会报 user gesture 错误。
    browser.sidePanel.open({ tabId }).catch(console.error);
  });
});

// 检查位置权限（用于蓝牙和WiFi功能）
function checkLocationAuth() {
  return new Promise((resolve, reject) => {
      wx.getSetting({
          success(res) {
              if (res.authSetting['scope.userLocation']) {
                  // 已授权
                  resolve();
              } else {
                  // 未授权则请求授权
                  wx.authorize({
                      scope: 'scope.userLocation',
                      success: resolve,
                      fail: () => {
                          // 用户拒绝授权，弹窗提示
                          wx.showModal({
                              title: '权限提醒',
                              content: '需要获取您的位置信息以使用蓝牙和WiFi功能。请在设置中手动开启“位置信息”权限，否则无法正常使用设备连接功能。',
                              confirmText: '去设置',
                              cancelText: '取消',
                              success: (modalRes) => {
                                  if (modalRes.confirm) {
                                      wx.openSetting();
                                  }
                                  reject();
                              }
                          });
                      }
                  });
              }
          }
      });
  });
}

// 检查蓝牙权限（依赖位置权限，并尝试打开蓝牙适配器）
function checkBluetoothAuth() {
  return new Promise((resolve, reject) => {
      checkLocationAuth()
         .then(() => {
              wx.openBluetoothAdapter({
                  success: resolve,
                  fail: () => {
                      // 蓝牙未开启或无权限，弹窗提示
                      wx.showModal({
                          title: '蓝牙权限提醒',
                          content: '请确保已开启蓝牙功能，并在系统设置中授权蓝牙权限，否则无法正常连接设备。',
                          confirmText: '去设置',
                          cancelText: '取消',
                          success: (modalRes) => {
                              if (modalRes.confirm) {
                                  wx.openSetting();
                              }
                              reject();
                          }
                      });
                  }
              });
          })
         .catch(reject);
  });
}

// 检查WiFi权限（只需位置权限）
function checkWifiAuth() {
  return checkLocationAuth();
}


module.exports = {
  checkLocationAuth,
  checkBluetoothAuth,
  checkWifiAuth
};
// pages/device/device.js
Page({
  data: {
    connectedDeviceId: '',
    serviceId: '',
    characteristicId: '',
    wifiList: [],
    selectedWifi: '',
    password: '',
    currentStatus: '未连接到蓝牙设备',
    statusMap: {
      '01': 'WIFI 连接上',
      '03': 'WIFI 连接失败',
      '04': 'WIFI 连接成功，TCP连接成功',
      '05': 'TCP 连接断开，一般 WIFI 也断了',
      '06': 'WIFI 连接断开，可能未分配IP',
      '07': '不在床'
    },
    isConnectedToWifi: false,
    currentConnectedWifi: null,
    deviceList: [],
    isRefreshingDevices: false,
    refreshingDistance: 0,
    hasLocationPermission: false,
    hasBluetoothPermission: false,
    hasWifiPermission: false
  },

  onLoad() {
    this.checkPermissions();
  },

  onBack(){
    wx.navigateBack()
  },
  toBlue(){
    wx.navigateTo({
      url: '/pages/blue/blue',
    })
  },
  // 权限管理
  async checkPermissions() {
    try {
      // 检查位置权限
      const locationRes = await wx.getSetting({});
      this.setData({
        hasLocationPermission: locationRes.authSetting['scope.userLocation'] || false
      });

      // 检查蓝牙权限
      const bluetoothRes = await wx.getSetting({});
      this.setData({
        hasBluetoothPermission: bluetoothRes.authSetting['scope.bluetooth'] || false
      });

      // 不直接检查WiFi权限，改为在使用时动态检查

      // 如果没有权限，则申请权限
      if (!this.data.hasLocationPermission) {
        await this.requestLocationPermission();
      }
      if (!this.data.hasBluetoothPermission) {
        await this.requestBluetoothPermission();
      }

      // 初始化蓝牙模块
      if (this.data.hasLocationPermission && this.data.hasBluetoothPermission) {
        this.initBluetooth();
      }
    } catch (error) {
      console.error('权限检查失败:', error);
      wx.showToast({
        title: '权限申请失败',
        icon: 'none'
      });
    }
  },

  async requestLocationPermission() {
    try {
      await wx.authorize({
        scope: 'scope.userLocation'
      });
      this.setData({
        hasLocationPermission: true
      });
      wx.showToast({
        title: '位置权限已获取',
        icon: 'success'
      });
      return true;
    } catch (error) {
      console.error('位置权限申请失败:', error);
      
      // 区分用户拒绝和系统拒绝
      if (error.errMsg.includes('auth deny')) {
        wx.showModal({
          title: '提示',
          content: '需要位置权限才能搜索蓝牙设备和WiFi',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      } else {
        wx.showToast({
          title: '位置权限申请失败',
          icon: 'none'
        });
      }
      return false;
    }
  },

  async requestBluetoothPermission() {
    try {
      await wx.authorize({
        scope: 'scope.bluetooth'
      });
      this.setData({
        hasBluetoothPermission: true
      });
      wx.showToast({
        title: '蓝牙权限已获取',
        icon: 'success'
      });
      return true;
    } catch (error) {
      console.error('蓝牙权限申请失败:', error);
      wx.showModal({
        title: '提示',
        content: '需要蓝牙权限来连接设备',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            wx.openSetting();
          }
        }
      });
      return false;
    }
  },

  // 蓝牙操作
  initBluetooth() {
    wx.openBluetoothAdapter({
      success: () => {
        wx.showToast({ title: '蓝牙已打开', icon: 'success' });
        this.startDiscoveringDevices();
      },
      fail: (err) => {
        console.error('打开蓝牙失败', err);
        if (err.errCode === 10001) {
          wx.showModal({
            title: '提示',
            content: '请打开蓝牙',
            success: (res) => {
              if (res.confirm) {
                // 引导用户打开蓝牙
              }
            }
          });
        }
      }
    });
  },

  startDiscoveringDevices() {
    this.setData({ isRefreshingDevices: true });
    wx.startBluetoothDevicesDiscovery({
      services: [],
      success: () => {
        this.setData({ deviceList: [] });
        this.listenForDevices();
        
        // 5秒后自动停止搜索
        setTimeout(() => {
          wx.stopBluetoothDevicesDiscovery();
          this.setData({ isRefreshingDevices: false });
        }, 5000);
      },
      fail: (err) => {
        console.error('搜索设备失败', err);
        wx.showToast({ title: '搜索设备失败', icon: 'none' });
        this.setData({ isRefreshingDevices: false });
      }
    });
  },

  listenForDevices() {
    wx.onBluetoothDeviceFound((res) => {
      res.devices.forEach(device => {
        if (device.name && device.name.includes('GOODSLEEP')) {
          const updatedList = [...this.data.deviceList];
          
          const existingIndex = updatedList.findIndex(d => d.deviceId === device.deviceId);
          if (existingIndex > -1) {
            updatedList[existingIndex] = device;
          } else {
            updatedList.push(device);
          }
          this.setData({ deviceList: updatedList });
        }
      });
    });
  },

  connectToDevice(deviceId) {
    wx.createBLEConnection({
      deviceId,
      success: () => {
        this.setData({ connectedDeviceId: deviceId });
        wx.showToast({ title: '成功连接到设备', icon: 'success' });
        this.findServiceAndCharacteristic(deviceId);
      },
      fail: (err) => {
        console.error('连接设备失败', err);
        wx.showToast({ title: '连接设备失败', icon: 'none' });
      }
    });
  },

  findServiceAndCharacteristic(deviceId) {
    wx.getBLEDeviceServices({
      deviceId,
      success: (res) => {
        if (res.services.length > 0) {
          // 假设第一个服务是我们需要的
          this.setData({ serviceId: res.services[0].uuid });
          this.getCharacteristics(deviceId, res.services[0].uuid);
        } else {
          wx.showToast({ title: '未找到可用服务', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('获取服务失败', err);
        wx.showToast({ title: '获取服务失败', icon: 'none' });
      }
    });
  },

  getCharacteristics(deviceId, serviceId) {
    wx.getBLEDeviceCharacteristics({
      deviceId,
      serviceId,
      success: (res) => {
        // 查找可写和可通知的特征值
        const writeChar = res.characteristics.find(char => char.properties.write);
        const notifyChar = res.characteristics.find(char => char.properties.notify);
        
        if (writeChar && notifyChar) {
          this.setData({ 
            characteristicId: writeChar.uuid,
            currentStatus: '等待配网指令'
          });
          this.startListeningForStatus(deviceId, serviceId, notifyChar.uuid);
          wx.showToast({ title: '已准备好发送配网指令', icon: 'success' });
        } else {
          wx.showToast({ title: '未找到合适的特征值', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('获取特征值失败', err);
        wx.showToast({ title: '获取特征值失败', icon: 'none' });
      }
    });
  },

  startListeningForStatus(deviceId, serviceId, characteristicId) {
    wx.notifyBLECharacteristicValueChange({
      deviceId,
      serviceId,
      characteristicId,
      state: true,
      success: () => {
        wx.showToast({ title: '正在监听设备状态', icon: 'success' });
        wx.onBLECharacteristicValueChange((res) => {
          this.parseStatus(res.value);
        });
      },
      fail: (err) => {
        console.error('启动监听失败', err);
        wx.showToast({ title: '启动监听失败', icon: 'none' });
      }
    });
  },

  parseStatus(buffer) {
    const dataView = new DataView(buffer);
    const hexArray = [];
    for (let i = 0; i < buffer.byteLength; i++) {
      hexArray.push((dataView.getUint8(i) & 0xff).toString(16).padStart(2, '0'));
    }
    const hexString = hexArray.join('');
    
    // 验证协议头
    if (hexString.startsWith('55aa55aa55aa')) {
      // 提取状态码
      const statusCode = hexString.slice(-2);
      const statusText = this.data.statusMap[statusCode] || `未知状态: ${statusCode}`;
      this.setData({ currentStatus: statusText });
      wx.showToast({ title: statusText, icon: 'none' });
    }
  },

  // WiFi操作
  stringToBytes(str) {
    const array = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      array[i] = str.charCodeAt(i);
    }
    return array.buffer;
  },

  // 改进的WiFi权限获取流程
  getWifiList() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.wifi']) {
          // 已有权限，直接获取WiFi列表
          this._startWifiAndGetList();
        } else {
          // 没有权限，先启动WiFi
          wx.startWifi({
            success: () => {
              // 启动成功后获取WiFi列表，此时会触发权限申请弹窗
              wx.getWifiList({
                success: () => {
                  // 监听WiFi列表返回
                  wx.onGetWifiList((res) => {
                    this.setData({ 
                      wifiList: res.wifiList,
                      hasWifiPermission: true
                    });
                  });
                },
                fail: (err) => {
                  console.error('获取WiFi列表失败', err);
                  if (err.errMsg.includes('auth deny')) {
                    // 用户拒绝了权限
                    wx.showModal({
                      title: '提示',
                      content: '需要WiFi权限来获取可用WiFi列表',
                      confirmText: '去设置',
                      success: (res) => {
                        if (res.confirm) {
                          wx.openSetting();
                        }
                      }
                    });
                  } else {
                    wx.showToast({ title: '获取WiFi列表失败', icon: 'none' });
                  }
                }
              });
            },
            fail: (err) => {
              console.error('启动WiFi失败', err);
              if (err.errMsg.includes('auth deny')) {
                wx.showModal({
                  title: '提示',
                  content: '需要WiFi权限来配置网络',
                  confirmText: '去设置',
                  success: (res) => {
                    if (res.confirm) {
                      wx.openSetting();
                    }
                  }
                });
              } else {
                wx.showToast({ title: '启动WiFi失败', icon: 'none' });
              }
            }
          });
        }
      }
    });
  },

  // 辅助方法：启动WiFi并获取列表
  _startWifiAndGetList() {
    wx.startWifi({
      success: () => {
        wx.getWifiList({
          success: () => {
            wx.onGetWifiList((res) => {
              this.setData({ 
                wifiList: res.wifiList,
                hasWifiPermission: true
              });
            });
          },
          fail: (err) => {
            console.error('获取WiFi列表失败', err);
            wx.showToast({ title: '获取WiFi列表失败', icon: 'none' });
          }
        });
      },
      fail: (err) => {
        console.error('启动WiFi失败', err);
        wx.showToast({ title: '启动WiFi失败', icon: 'none' });
      }
    });
  },

  getConnectedWifi() {
    wx.getConnectedWifi({
      success: (res) => {
        this.setData({ 
          isConnectedToWifi: true,
          currentConnectedWifi: res.wifi,
          selectedWifi: res.wifi.SSID
        });
      },
      fail: (err) => {
        this.setData({ isConnectedToWifi: false });
        console.error('获取当前连接的WiFi失败', err);
      }
    });
  },

  selectWifi(e) {
    const wifi = e.currentTarget.dataset.wifi;
    this.setData({ selectedWifi: wifi.SSID });
  },

  inputPassword(e) {
    this.setData({ password: e.detail.value });
  },

  connectToWifi() {
    if (!this.data.selectedWifi) {
      wx.showToast({ title: '请选择WiFi', icon: 'none' });
      return;
    }
    
    if (!this.data.isConnectedToWifi) {
      // 如果手机未连接WiFi，则连接指定WiFi
      if (!this.data.password) {
        wx.showToast({ title: '请输入WiFi密码', icon: 'none' });
        return;
      }
      
      wx.connectWifi({
        SSID: this.data.selectedWifi,
        password: this.data.password,
        success: () => {
          wx.showToast({ title: '手机已连接WiFi', icon: 'success' });
          this.setData({ isConnectedToWifi: true });
          this.sendWifiConfig();
        },
        fail: (err) => {
          console.error('连接WiFi失败', err);
          wx.showToast({ title: '连接WiFi失败', icon: 'none' });
        }
      });
    } else {
      // 如果手机已连接WiFi，直接发送配置
      this.sendWifiConfig();
    }
  },

  sendWifiConfig() {
    if (!this.data.connectedDeviceId || !this.data.serviceId || !this.data.characteristicId) {
      wx.showToast({ title: '请先连接蓝牙设备', icon: 'none' });
      return;
    }

    const ssid = this.data.selectedWifi;
    const password = this.data.password || '';
    
    // 构造配网指令
    const command = `Good Sleep WIFI ID:"${ssid}","${password}"`;
    const buffer = this.stringToBytes(command);

    wx.writeBLECharacteristicValue({
      deviceId: this.data.connectedDeviceId,
      serviceId: this.data.serviceId,
      characteristicId: this.data.characteristicId,
      value: buffer,
      success: () => {
        wx.showToast({ title: '配网指令已发送', icon: 'success' });
        this.setData({ currentStatus: '等待设备连接WiFi...' });
      },
      fail: (err) => {
        console.error('发送配网指令失败', err);
        wx.showToast({ title: '发送配网指令失败', icon: 'none' });
      }
    });
  },

  // 下拉刷新相关方法
  onTouchStart(e) {
    if (!this.data.connectedDeviceId) {
      this.startY = e.touches[0].clientY;
    }
  },

  onTouchMove(e) {
    if (!this.data.connectedDeviceId && this.startY) {
      const moveY = e.touches[0].clientY;
      const distance = moveY - this.startY;
      
      if (distance > 0) {
        this.setData({ refreshingDistance: Math.min(distance, 150) });
      }
    }
  },

  onTouchEnd() {
    if (!this.data.connectedDeviceId && this.data.refreshingDistance > 100) {
      this.startDiscoveringDevices();
    }
    this.setData({ refreshingDistance: 0 });
    this.startY = null;
  }
});
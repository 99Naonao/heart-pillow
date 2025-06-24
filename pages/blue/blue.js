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
  
  Page({
    data: {
        //步骤
        currentTab: 0, // 当前步骤
        stepsCompleted: [false, false, false], // 步骤完成状态
        totalSteps: 3, // 总步骤数
        progress: 33.33, // 进度条
        //蓝牙
        devices: [], // 搜索到的蓝牙设备
        connectedDeviceId: '', // 已连接的蓝牙设备ID.
        send_characteristicId: '', // 写入特征值ID
        notify_cId: '', // 通知特征值ID
        serviceId: '', // 服务ID
        isRefreshing: false, // 下拉刷新状态
        //wifi
        isWifiConnected: false, // 手机是否已连接WiFi
        wifiName: '', // 当前或已选WiFi名称
        wifiList: [], // 可选WiFi列表
        wifiPassword: '', // WiFi密码
        wifiSelected: false, // 是否已选WiFi
        wifiConnectSuccess: false, //wifi连接状态
        showWifiList:false, //是否显示wifi列表
        is5GConnected: false //是否5G
    },
  
    // 页面加载时初始化进度
    onLoad() {
        this.setData({
            progress: (1 / this.data.totalSteps) * 100
        });
    },
  
    // 页面显示时，如果在蓝牙步骤则自动搜索设备
    onShow() {
        this.isPageActive = true;
        if (this.data.currentTab === 0) {
            this.checkAllPermissions()
               .then(() => {
                    this.searchBluetoothDevices();
                })
               .catch(() => {
                    wx.showToast({ title: '权限不足，无法搜索设备', icon: 'none' });
                });
        }
    },
  
    onHide() {
        this.isPageActive = false;
    },
  
    onUnload() {
        this.isPageActive = false;
    },
  
    // 检查所有权限（蓝牙步骤时调用）
    checkAllPermissions() {
        return checkBluetoothAuth();
    },
  
    // scroll-view下拉刷新（仅蓝牙步骤可用）
    onContentRefresh() {
        if (this.data.currentTab === 0) {
            this.setData({ isRefreshing: true });
            this.checkAllPermissions()
               .then(() => {
                    this.searchBluetoothDevices(() => {
                        this.setData({ isRefreshing: false });
                    });
                })
               .catch(() => {
                    this.setData({ isRefreshing: false });
                    wx.showToast({ title: '权限不足，无法搜索设备', icon: 'none' });
                });
        } else {
            this.setData({ isRefreshing: false });
        }
    },
  
    // 搜索蓝牙设备，只显示名称包含GOODSLEEP的设备
    async searchBluetoothDevices(callback) {
        const searchDuration = 2000; // 延长搜索时间到3秒
        const maxRetryCount = 3; // 最大重试次数
        let retryCount = 0;
  
        while (retryCount < maxRetryCount) {
            try {
                await this.openBluetoothAdapter();
                console.log('蓝牙适配器已打开，开始搜索设备...');
                await this.startBluetoothDevicesDiscovery();
                await new Promise(resolve => setTimeout(resolve, searchDuration));
                const res = await this.getBluetoothDevices();
                console.log('所有搜索到的设备:', res.devices);
                const goodsleepDevices = res.devices.filter(d => d.name && d.name.indexOf('GOODSLEEP') !== -1);
                console.log('筛选后的GOODSLEEP设备:', goodsleepDevices);
                this.setData({ devices: goodsleepDevices });
                await this.stopBluetoothDevicesDiscovery();
  
                if (goodsleepDevices.length > 0) {
                    if (typeof callback === 'function') callback();
                    return;
                } else {
                    console.log(`未搜索到设备，进行第 ${retryCount + 1} 次重试...`);
                    retryCount++;
                }
            } catch (err) {
                console.error('搜索蓝牙设备出错:', err);
                console.log(`搜索失败，进行第 ${retryCount + 1} 次重试...`);
                retryCount++;
            }
        }
  
        wx.showModal({
            title: '未搜索到设备',
            content: '如长时间未搜索到设备，请尝试关闭手机蓝牙后重新打开再试。',
            showCancel: false
        });
        if (typeof callback === 'function') callback();
    },
  
    openBluetoothAdapter() {
        return new Promise((resolve, reject) => {
            wx.openBluetoothAdapter({
                success: resolve,
                fail: (err) => {
                    console.error('openBluetoothAdapter失败:', err);
                    wx.showToast({ title: '请打开蓝牙', icon: 'none' });
                    reject(err);
                }
            });
        });
    },
  
    startBluetoothDevicesDiscovery() {
        return new Promise((resolve, reject) => {
            wx.startBluetoothDevicesDiscovery({
                allowDuplicatesKey: false,
                success: resolve,
                fail: (err) => {
                    console.error('startBluetoothDevicesDiscovery失败:', err);
                    reject(err);
                }
            });
        });
    },
  
    getBluetoothDevices() {
        return new Promise((resolve, reject) => {
            wx.getBluetoothDevices({
                success: resolve,
                fail: (err) => {
                    console.error('获取蓝牙设备列表失败:', err);
                    reject(err);
                }
            });
        });
    },
  
    stopBluetoothDevicesDiscovery() {
        return new Promise((resolve, reject) => {
            wx.stopBluetoothDevicesDiscovery({
                success: resolve,
                fail: (err) => {
                    console.error('stopBluetoothDevicesDiscovery失败:', err);
                    reject(err);
                }
            });
        });
    },
  
    // 连接蓝牙设备
    connectBluetooth(e) {
        const deviceId = e.currentTarget.dataset.mac;
        console.log('准备连接设备，deviceId:', deviceId);
        wx.createBLEConnection({
            deviceId,
            success: () => {
                console.log('蓝牙连接成功:', deviceId);
                this.setData({ connectedDeviceId: deviceId });
                wx.showToast({ title: '蓝牙已连接', icon: 'success' });
                // 获取服务和特征值
                this.getServiceAndCharacteristics(deviceId);
            },
            fail: (err) => {
                console.error('蓝牙连接失败:', err);
                wx.showToast({ title: '连接失败', icon: 'none' });
            }
        });
    },
  
    // 动态获取服务和特征值ID
    getServiceAndCharacteristics(deviceId) {
        console.log('获取服务列表，deviceId:', deviceId);
        wx.getBLEDeviceServices({
            deviceId,
            success: (res) => {
                console.log('服务列表:', res.services);
                // 选第一个自定义服务或主服务
                const service = res.services.find(s => s.uuid.toUpperCase().indexOf('6E400001') !== -1 || s.isPrimary);
                if (service) {
                    const serviceId = service.uuid;
                    this.setData({ serviceId });
                    console.log('选中的服务ID:', serviceId);
                    wx.getBLEDeviceCharacteristics({
                        deviceId,
                        serviceId,
                        success: (resCha) => {
                            console.log('特征值列表:', resCha.characteristics);
                            let send_characteristicId = '';
                            let notify_cId = '';
                            // 遍历特征值，按uuid前缀筛选
                            for (let i = 0; i < resCha.characteristics.length; i++) {
                                const uuid = resCha.characteristics[i].uuid;
                                const uuidPrefix = uuid.substring(0, 8).toUpperCase();
                                if (uuidPrefix === "0000C304") {
                                    send_characteristicId = uuid;
                                } else if (uuidPrefix === "0000C305") {
                                    notify_cId = uuid;
                                }
                            }
                            console.log('写入特征值ID:', send_characteristicId, '通知特征值ID:', notify_cId);
                            this.setData({
                                send_characteristicId,
                                notify_cId
                            });
                            // 进入下一步
                            this.onBluetoothConnected();
                        },
                        fail: (err) => {
                            console.error('获取特征值列表失败:', err);
                            wx.showToast({ title: '获取特征值失败', icon: 'none' });
                        }
                    });
                } else {
                    wx.showToast({ title: '未找到服务', icon: 'none' });
                    console.error('未找到目标服务');
                }
            },
            fail: (err) => {
                console.error('获取服务列表失败:', err);
                wx.showToast({ title: '获取服务列表失败', icon: 'none' });
            }
        });
    },
  
    // 蓝牙连接成功后进入WiFi配网步骤
    onBluetoothConnected() {
        this.setData({
            currentTab: 1,
            stepsCompleted: [true, false, false],
            progress: (2 / this.data.totalSteps) * 100
        });
        this.initWifiStep();
    },
  
    // 初始化WiFi步骤，判断手机是否已连接WiFi
    async initWifiStep() {
        if (!this.isPageActive) {
            console.log('页面已隐藏，不再进行WiFi初始化');
            return;
        }
        console.log('开始初始化WiFi步骤...');
        try {
            await checkWifiAuth();
            await this.startWifi();
            console.log('startWifi 成功，准备获取当前已连接WiFi...');
            const res = await this.getConnectedWifi();
            console.log('手机已连接WiFi，SSID:', res.wifi.SSID);
            //判断是否为5G
            const is5G = res.wifi.frequency && res.wifi.frequency >= 3000;
            this.setData({
                isWifiConnected: true,
                wifiName: res.wifi.SSID,
                wifiSelected: true,
                showWifiList:false,
                is5GConnected:is5G
            });
            if(is5G){
              wx.showModal({
                title: '温馨提示',
                content: '当前连接的是5G WiFi，仅支持2.4G WiFi，请更换WiFi',
                confirmText: '更换wifi',
                cancelText: '取消',
                success: (res) => {
                    if (res.confirm) {
                        this.showWifiList();
                    }
                }
            });
            }
        } catch (err) {
            console.log('手机未连接WiFi，准备获取WiFi列表...');
            try {
                await this.getWifiList();
            } catch (err) {
                console.error('获取WiFi列表失败');
                wx.showModal({
                    title: '提示',
                    content: '获取WiFi列表失败，请确保已打开手机WiFi开关并授权位置信息。',
                    showCancel: false
                });
                this.setData({
                    isWifiConnected: false,
                    wifiList: [],
                    wifiSelected: false,
                    showWifiList:false,
                    is5GConnected:false
                });
            }
        }
    },
  
    startWifi() {
        return new Promise((resolve, reject) => {
            wx.startWifi({
                success: resolve,
                fail: () => {
                    console.error('startWifi 失败，请先在手机上打开WiFi开关');
                    wx.showModal({
                        title: '提示',
                        content: '请先在手机上打开WiFi开关。',
                        showCancel: false
                    });
                    reject();
                }
            });
        });
    },
  
    getConnectedWifi() {
        return new Promise((resolve, reject) => {
            wx.getConnectedWifi({
                success: resolve,
                fail: reject
            });
        });
    },
  
    getWifiList() {
      return new Promise((resolve, reject) => {
        // 先移除之前的监听，防止多次注册
        wx.offGetWifiList && wx.offGetWifiList();
        wx.getWifiList({
          success: () => {
            wx.onGetWifiList((listRes) => {
              // 只保留2.4G WiFi
              const wifiList = (listRes.wifiList || []).filter(item => item.frequency && item.frequency < 3000 && item.SSID);
              this.setData({
                isWifiConnected: false,
                wifiList: wifiList,
                wifiSelected: false
              });
              resolve();
            });
          },
          fail: reject
        });
      });
    },
  
    // 点击“更换WiFi”按钮
    showWifiList() {
      this.getWifiList().then(() => {
        this.setData({
          showWifiList: true,
          wifiSelected: false
        });
      });
    },
    
    // 选择WiFi（仅未连接时可选）
    selectWifi(e) {
      const ssid = e.currentTarget.dataset.ssid;
      const frequency = e.currentTarget.dataset.frequency;
      if (frequency >= 3000) {
        wx.showToast({ title: '不支持5G WiFi', icon: 'none' });
        return;
      }
      console.log('用户选择了WiFi:', ssid);
      this.setData({
        wifiName: ssid,
        wifiSelected: true,
        showWifiList:false
      });
    },
  
    // WiFi密码输入
    onInputPassword(e) {
        console.log('用户输入WiFi密码:', e.detail.value);
        this.setData({
            wifiPassword: e.detail.value
        });
    },
  
    // 发送配网指令
    sendWifiConfig() {
        if (!this.isPageActive) {
            console.log('页面已隐藏，不再发送配网指令');
            return;
        }
        const { connectedDeviceId, serviceId, send_characteristicId, notify_cId, wifiName, wifiPassword } = this.data;
        if (!connectedDeviceId || !serviceId || !send_characteristicId || !notify_cId || !wifiName || !wifiPassword) {
            wx.showToast({ title: '请先连接蓝牙并输入WiFi信息', icon: 'none' });
            return;
        }
        const cmd = `Good Sleep WIFI ID:"${wifiName}","${wifiPassword}"`;
        const buffer = this.stringToHex(cmd);
  
        console.log('准备发送配网指令:', cmd);
        wx.writeBLECharacteristicValue({
            deviceId: connectedDeviceId,
            serviceId: serviceId,
            characteristicId: send_characteristicId,
            value: buffer,
            success: () => {
                console.log('配网指令发送成功，等待设备返回状态...');
                wx.showLoading({ title: 'WiFi连接中' });
                this.listenForDeviceStatus();
            },
            fail: (err) => {
                console.error('配网指令发送失败:', err);
                wx.showToast({ title: '配网指令发送失败', icon: 'none' });
            }
        });
    },
  
    // 监听设备返回的配网状态
    listenForDeviceStatus() {
        if (!this.isPageActive) {
            console.log('页面已隐藏，不再监听设备状态');
            return;
        }
        const { connectedDeviceId, serviceId, notify_cId } = this.data;
        wx.notifyBLECharacteristicValueChange({
            deviceId: connectedDeviceId,
            serviceId: serviceId,
            characteristicId: notify_cId,
            state: true,
            success: () => {
                wx.onBLECharacteristicValueChange((res) => {
                    const value = new Uint8Array(res.value);
                    const status = value[value.length - 1];
                    console.log('收到设备返回的配网状态码:', status, '原始数据:', value);
                    wx.hideLoading();
                    // 按协议解析状态码
                    this.handleDeviceStatus(status);
                });
            },
            fail: (err) => {
                console.error('启用特征值通知失败:', err);
                wx.showToast({ title: '监听设备状态失败', icon: 'none' });
            }
        });
    },
  
    handleDeviceStatus(status) {
      if (!this.isPageActive) return;
      if ((status === 0x01 || status === 0x04) && !this.data.wifiConnectSuccess) {
        this.setData({ wifiConnectSuccess: true });
        wx.showToast({ title: 'WIFI连接上', icon: 'success' });
        this.completeStep();
      } else if (status === 0x03) {
        wx.showToast({ title: 'WIFI连接失败', icon: 'none' });
      } else if (status === 0x05) {
        wx.showToast({ title: 'TCP断开', icon: 'none' });
      } else if (status === 0x06) {
        wx.showToast({ title: 'WIFI断开', icon: 'none' });
      } else if (status === 0x07) {
        wx.showToast({ title: '不在床', icon: 'none' });
      } else if (status !== 0x01 && status !== 0x04) {
        wx.showToast({ title: '未知状态', icon: 'none' });
      }
    },
  
    // 步骤完成，自动进入下一步
    completeStep() {
        const currentTab = this.data.currentTab;
        const stepsCompleted = [...this.data.stepsCompleted];
        stepsCompleted[currentTab] = true;
        let nextTab = currentTab;
        if (currentTab < this.data.totalSteps - 1) {
            nextTab = currentTab + 1;
        }
        const progress = parseFloat(((nextTab + 1) / this.data.totalSteps * 100).toFixed(2));
        this.setData({
            stepsCompleted: stepsCompleted,
            currentTab: nextTab,
            progress: progress
        });
    },
  
    // 配网完成，返回首页
    finishAndReturn() {
        const stepsCompleted = [...this.data.stepsCompleted];
        stepsCompleted[2] = true;
        this.setData({
            stepsCompleted: stepsCompleted,
            progress: 100
        });
        wx.navigateTo({
          url: '/pages/home/home'
        });
    },
  
    // 字符串转ArrayBuffer
    stringToHex(str) {
        var dataView = new Uint8Array(str.length);
        for (var i = 0, l = str.length; i < l; i++) {
            dataView[i] = str.charCodeAt(i);
        }
        // console.log('字符串转字符数组',dataView)
        return dataView.buffer;
    },
  
    // 返回上一级
    onBack() {
        wx.navigateBack();
    }
  });
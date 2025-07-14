const wxLogin = 'https://sleep.zsyl.cc/api/ybLoginWx';


function autoLogin(callback){
  onGetCode().then((code)=>{
    
  });
}


/**
 * 获取登录凭证
 */
async function onGetCode(){
  return new Promise((resolve,reject)=>{
      wx.login({
        success:function(loginRes){
          console.log("获取到登录凭证，code==",loginRes.code)    
          const code = loginRes.code;
          resolve(code);
        },
        fail:(res)=>{
          console.error("获取登录凭证失败,",res);
          wx.showToast({
            title: '登录失败，请稍后再试',
            icon:'none',
            duration:2000
          });
          reject(new Error(res.errMsg || "获取登录凭证失败"));
        }
      });
  });
}

function request(url,data){
  return new Promise((resolve,reject)=>{
    wx.showLoading({title: '正在加载中...'});
    wx.request({
      url: url,
      data: data,
      method:"",
      header:{
        'Content-Type': 'application/json',
        'token':""
      },
      success:(res)=>{
        wx.hideLoading();
        const{ 
          code,
          data:respontData,
          message
        } = res.data;
        if(code === 200){
          resolve(respontData);
        }else{
          
        }
      },
      fail:(err)=>{
        wx.hideLoading();
        reject(new Error(err.errMsg) || "网络异常");
      }
    })
  });
}
import IPromise from "./promise.js";

const promise = new IPromise((resolve, reject) => {
  // 同步执行
  if (Math.random() > 0.5) {
    resolve("成功了！");
  } else {
    reject("失败了！");
  }
});

// 异步执行
const asyncPromise = new IPromise((resolve, reject) => {
  setTimeout(() => {
    resolve("异步成功！");
  }, 1000);
});

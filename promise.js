class IPromise {
  static PENDING = "pending";
  static FULFILLED = "fulfilled";
  static REJECTED = "rejected";

  constructor(executor) {
    // 当前状态
    this.state = IPromise.PENDING;
    // 成功的值
    this.value = undefined;
    // 失败的原因
    this.reason = undefined;
    // 成功回调队列
    this.onFulfilledCallbacks = [];
    // 失败回调队列
    this.onRejectedCallbacks = [];

    const resolve = (value) => {
      if (this.state === IPromise.PENDING) {
        this.state = IPromise.FULFILLED;
        this.value = value;
        this.onFulfilledCallbacks.forEach((cb) => cb(value));
      }
    };

    const reject = (reason) => {
      if (this.state === IPromise.PENDING) {
        this.state = IPromise.REJECTED;
        this.reason = reason;
        this.onRejectedCallbacks.forEach((cb) => cb(reason));
      }
    };

    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }

  /**
   * then 方法
   * @param {Function} onFulfilled - 成功时的回调函数
   * @param {Function} onRejected - 失败时的回调函数
   * @returns {IPromise} 返回一个新的 Promise 实例，支持链式调用
   */
  then(onFulfilled, onRejected) {
    // 2.2.7规范 then 方法必须返回一个 promise 对象 实现链式调用
    const promise2 = new IPromise((resolve, reject) => {
      // 统一的回调处理函数
      const handle = (callback, value, isReject) => {
        // 使用 setTimeout 确保异步执行，符合 Promise/A+ 规范
        setTimeout(() => {
          try {
            if (typeof callback !== "function") {
              (isReject ? reject : resolve)(value);
            } else {
              // 执行回调函数，获取返回值
              const result = callback(value);
              // 处理返回值，可能是 普通值 或 Promise
              resolvePromise(promise2, result, resolve, reject);
            }
          } catch (error) {
            reject(error);
          }
        });
      };

      if (this.state === IPromise.FULFILLED) {
        handle(onFulfilled, this.value);
      } else if (this.state === IPromise.REJECTED) {
        handle(onRejected, this.reason, true);
      } else {
        // PENDING 状态：加入回调队列
        this.onFulfilledCallbacks.push(() => handle(onFulfilled, this.value));
        this.onRejectedCallbacks.push(() =>
          handle(onRejected, this.reason, true)
        );
      }
    });

    return promise2;
  }

  /**
   * Promise.resolve 静态方法
   * @param {*} value - 要解析的值
   * @returns {IPromise} 返回一个成功状态的 Promise
   */
  static resolve(value) {
    // 如果传入的值已经是 Promise 实例，直接返回
    if (value instanceof IPromise) {
      return value;
    }
    // 否则创建一个新的 Promise，立即 resolve 传入的值
    return new IPromise((resolve) => resolve(value));
  }

  /**
   * Promise.reject 静态方法
   * @param {*} reason - 拒绝的原因
   * @returns {IPromise} 返回一个失败状态的 Promise
   */
  static reject(reason) {
    // 创建一个新的 Promise，立即 reject 传入的原因
    return new IPromise((_, reject) => reject(reason));
  }

  /**
   * catch 方法：用于捕获 Promise 的错误
   * @param {Function} onRejected - 失败时的回调函数
   * @returns {IPromise} 返回新的 Promise 实例
   */
  catch(onRejected) {
    // catch 实际上是 then(null, onRejected) 的语法糖
    return this.then(null, onRejected);
  }

  /**
   * finally 方法：无论成功失败都会执行的回调
   * @param {Function} onFinally - 最终都会执行的回调函数
   * @returns {IPromise} 返回新的 Promise 实例
   */
  finally(onFinally) {
    return this.then(
      // 成功时：执行 finally 回调，然后传递原值
      (value) => IPromise.resolve(onFinally()).then(() => value),
      // 失败时：执行 finally 回调，然后重新抛出错误
      (reason) =>
        IPromise.resolve(onFinally()).then(() => {
          throw reason;
        })
    );
  }

  // TODO: resolvePromise
}

export default IPromise;

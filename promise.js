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
}

/**
 * Promise 解析过程
 * 这是 Promise/A+ 规范中最复杂的部分，用于处理 then 方法返回值的各种情况
 *
 * @param {IPromise} promise2 - then 方法返回的新 Promise
 * @param {*} x - then 回调函数的返回值
 * @param {Function} resolve - promise2 的 resolve 方法
 * @param {Function} reject - promise2 的 reject 方法
 */
function resolvePromise(promise2, x, resolve, reject) {
  // 如果 promise2 和 x 指向同一对象，以 TypeError 为据因拒绝执行 promise2
  // 这是为了避免循环引用
  if (promise2 === x) {
    return reject(new TypeError("Chaining cycle detected for promise"));
  }

  // 如果 x 为 Promise 实例，则使 promise2 接受 x 的状态
  if (x instanceof IPromise) {
    return x.then(
      // 如果 x 最终成功，递归解析成功的值
      (y) => resolvePromise(promise2, y, resolve, reject),
      // 如果 x 最终失败，直接 reject
      reject
    );
  }

  // 如果 x 为对象或函数（可能是 thenable 对象）
  if (x !== null && (typeof x === "object" || typeof x === "function")) {
    let called = false; // 确保只调用一次，防止重复调用

    try {
      // 把 x.then 赋值给 then
      const then = x.then;

      // 如果 then 是函数，将 x 作为函数的作用域 this 调用
      if (typeof then === "function") {
        then.call(
          x,
          // 如果 resolvePromise 以值 y 为参数被调用，则运行 resolvePromise
          (y) => {
            if (called) return; // 如果已经调用过，则忽略
            called = true;
            // 递归解析，因为 y 可能还是 thenable
            resolvePromise(promise2, y, resolve, reject);
          },
          // 如果 rejectPromise 以据因 r 为参数被调用，则以据因 r 拒绝 promise2
          (r) => {
            if (called) return; // 如果已经调用过，则忽略
            called = true;
            reject(r);
          }
        );
      } else {
        // 如果 then 不是函数，以 x 为参数执行 promise2
        resolve(x);
      }
    } catch (error) {
      // 如果取 x.then 的值时抛出错误 e，则以 e 为据因拒绝 promise2
      // 如果调用 then 方法抛出了异常 e
      if (called) return; // 如果已经调用过，则忽略
      called = true;
      reject(error);
    }
  } else {
    // 如果 x 不为对象或者函数，以 x 为参数执行 promise2
    resolve(x);
  }
}

export default IPromise;

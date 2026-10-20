import test from 'node:test';
import assert from 'node:assert/strict';
import {requestAllowed} from '../server/inventory-bridge.mjs';
const headers={host:'127.0.0.1:1425','x-prism-token':'test-secret',origin:'http://127.0.0.1:1425','sec-fetch-site':'same-origin'};
test('库存桥接仅允许带 token 的本机同源请求',()=>{assert.equal(requestAllowed({headers},'test-secret',1425),true);});
test('库存桥接拒绝 CSRF、跨域和 DNS rebinding Host',()=>{
 for(const patch of [{'x-prism-token':''},{origin:'https://evil.example'},{host:'evil.example:1425'},{'sec-fetch-site':'cross-site'}]) assert.equal(requestAllowed({headers:{...headers,...patch}},'test-secret',1425),false);
});
test('库存事件 GET 不要求浏览器一定发送 Origin，但必须有 token',()=>{
 const {origin,...withoutOrigin}=headers;
 assert.equal(requestAllowed({headers:withoutOrigin},'test-secret',1425),true);
 assert.equal(requestAllowed({headers:{...withoutOrigin,'x-prism-token':undefined}},'test-secret',1425),false);
});

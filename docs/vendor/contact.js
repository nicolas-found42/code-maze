import{BufferAttribute as li,Box3 as hn,FrontSide as xn}from"./three.module.js";var Pe=Math.pow(2,-24),Ct=Symbol("SKIP_GENERATION");import{BufferAttribute as wn}from"./three.module.js";function bn(n){return n.index?n.index.count:n.attributes.position.count}function Z(n){return bn(n)/3}function gn(n,e=ArrayBuffer){return n>65535?new Uint32Array(new e(4*n)):new Uint16Array(new e(2*n))}function Se(n,e){if(!n.index){let t=n.attributes.position.count,i=e.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,s=gn(t,i);n.setIndex(new wn(s,1));for(let a=0;a<t;a++)s[a]=a}}function ie(n,e){let t=Z(n),i=e||n.drawRange,s=i.start/3,a=(i.start+i.count)/3,r=Math.max(0,s),c=Math.min(t,a)-r;return[{offset:Math.floor(r),count:Math.floor(c)}]}function re(n,e){if(!n.groups||!n.groups.length)return ie(n,e);let t=[],i=new Set,s=e||n.drawRange,a=s.start/3,r=(s.start+s.count)/3;for(let o of n.groups){let p=o.start/3,f=(o.start+o.count)/3;i.add(Math.max(a,p)),i.add(Math.min(r,f))}let c=Array.from(i.values()).sort((o,p)=>o-p);for(let o=0;o<c.length-1;o++){let p=c[o],f=c[o+1];t.push({offset:Math.floor(p),count:Math.floor(f-p)})}return t}function Ee(n,e){let t=Z(n),i=re(n,e).sort((r,c)=>r.offset-c.offset),s=i[i.length-1];s.count=Math.min(t-s.offset,s.count);let a=0;return i.forEach(({count:r})=>a+=r),t!==a}function Rt(n,e,t,i,s){let a=1/0,r=1/0,c=1/0,o=-1/0,p=-1/0,f=-1/0,u=1/0,l=1/0,m=1/0,w=-1/0,b=-1/0,y=-1/0;for(let x=e*6,d=(e+t)*6;x<d;x+=6){let h=n[x+0],A=n[x+1],T=h-A,B=h+A;T<a&&(a=T),B>o&&(o=B),h<u&&(u=h),h>w&&(w=h);let g=n[x+2],_=n[x+3],v=g-_,S=g+_;v<r&&(r=v),S>p&&(p=S),g<l&&(l=g),g>b&&(b=g);let E=n[x+4],P=n[x+5],D=E-P,I=E+P;D<c&&(c=D),I>f&&(f=I),E<m&&(m=E),E>y&&(y=E)}i[0]=a,i[1]=r,i[2]=c,i[3]=o,i[4]=p,i[5]=f,s[0]=u,s[1]=l,s[2]=m,s[3]=w,s[4]=b,s[5]=y}function De(n,e=null,t=null,i=null){let s=n.attributes.position,a=n.index?n.index.array:null,r=Z(n),c=s.normalized,o;e===null?(o=new Float32Array(r*6),t=0,i=r):(o=e,t=t||0,i=i||r);let p=s.array,f=s.offset||0,u=3;s.isInterleavedBufferAttribute&&(u=s.data.stride);let l=["getX","getY","getZ"];for(let m=t;m<t+i;m++){let w=m*3,b=m*6,y=w+0,x=w+1,d=w+2;a&&(y=a[y],x=a[x],d=a[d]),c||(y=y*u+f,x=x*u+f,d=d*u+f);for(let h=0;h<3;h++){let A,T,B;c?(A=s[l[h]](y),T=s[l[h]](x),B=s[l[h]](d)):(A=p[y+h],T=p[x+h],B=p[d+h]);let g=A;T<g&&(g=T),B<g&&(g=B);let _=A;T>_&&(_=T),B>_&&(_=B);let v=(_-g)/2,S=h*2;o[b+S+0]=g+v,o[b+S+1]=v+(Math.abs(g)+v)*Pe}}return o}function M(n,e,t){return t.min.x=e[n],t.min.y=e[n+1],t.min.z=e[n+2],t.max.x=e[n+3],t.max.y=e[n+4],t.max.z=e[n+5],t}function se(n){let e=-1,t=-1/0;for(let i=0;i<3;i++){let s=n[i+3]-n[i];s>t&&(t=s,e=i)}return e}function oe(n,e){e.set(n)}function ce(n,e,t){let i,s;for(let a=0;a<3;a++){let r=a+3;i=n[a],s=e[a],t[a]=i<s?i:s,i=n[r],s=e[r],t[r]=i>s?i:s}}function bt(n,e,t){for(let i=0;i<3;i++){let s=e[n+2*i],a=e[n+2*i+1],r=s-a,c=s+a;r<t[i]&&(t[i]=r),c>t[i+3]&&(t[i+3]=c)}}function ct(n){let e=n[3]-n[0],t=n[4]-n[1],i=n[5]-n[2];return 2*(e*t+t*i+i*e)}var W=32,vn=(n,e)=>n.candidate-e.candidate,J=new Array(W).fill().map(()=>({count:0,bounds:new Float32Array(6),rightCacheBounds:new Float32Array(6),leftCacheBounds:new Float32Array(6),candidate:0})),Ut=new Float32Array(6);function Fe(n,e,t,i,s,a){let r=-1,c=0;if(a===0)r=se(e),r!==-1&&(c=(e[r]+e[r+3])/2);else if(a===1)r=se(n),r!==-1&&(c=_n(t,i,s,r));else if(a===2){let o=ct(n),p=1.25*s,f=i*6,u=(i+s)*6;for(let l=0;l<3;l++){let m=e[l],y=(e[l+3]-m)/W;if(s<W/4){let x=[...J];x.length=s;let d=0;for(let A=f;A<u;A+=6,d++){let T=x[d];T.candidate=t[A+2*l],T.count=0;let{bounds:B,leftCacheBounds:g,rightCacheBounds:_}=T;for(let v=0;v<3;v++)_[v]=1/0,_[v+3]=-1/0,g[v]=1/0,g[v+3]=-1/0,B[v]=1/0,B[v+3]=-1/0;bt(A,t,B)}x.sort(vn);let h=s;for(let A=0;A<h;A++){let T=x[A];for(;A+1<h&&x[A+1].candidate===T.candidate;)x.splice(A+1,1),h--}for(let A=f;A<u;A+=6){let T=t[A+2*l];for(let B=0;B<h;B++){let g=x[B];T>=g.candidate?bt(A,t,g.rightCacheBounds):(bt(A,t,g.leftCacheBounds),g.count++)}}for(let A=0;A<h;A++){let T=x[A],B=T.count,g=s-T.count,_=T.leftCacheBounds,v=T.rightCacheBounds,S=0;B!==0&&(S=ct(_)/o);let E=0;g!==0&&(E=ct(v)/o);let P=1+1.25*(S*B+E*g);P<p&&(r=l,p=P,c=T.candidate)}}else{for(let h=0;h<W;h++){let A=J[h];A.count=0,A.candidate=m+y+h*y;let T=A.bounds;for(let B=0;B<3;B++)T[B]=1/0,T[B+3]=-1/0}for(let h=f;h<u;h+=6){let B=~~((t[h+2*l]-m)/y);B>=W&&(B=W-1);let g=J[B];g.count++,bt(h,t,g.bounds)}let x=J[W-1];oe(x.bounds,x.rightCacheBounds);for(let h=W-2;h>=0;h--){let A=J[h],T=J[h+1];ce(A.bounds,T.rightCacheBounds,A.rightCacheBounds)}let d=0;for(let h=0;h<W-1;h++){let A=J[h],T=A.count,B=A.bounds,_=J[h+1].rightCacheBounds;T!==0&&(d===0?oe(B,Ut):ce(B,Ut,Ut)),d+=T;let v=0,S=0;d!==0&&(v=ct(Ut)/o);let E=s-d;E!==0&&(S=ct(_)/o);let P=1+1.25*(v*d+S*E);P<p&&(r=l,p=P,c=A.candidate)}}}}else console.warn(`MeshBVH: Invalid build strategy value ${a} used.`);return{axis:r,pos:c}}function _n(n,e,t,i){let s=0;for(let a=e,r=e+t;a<r;a++)s+=n[a*6+i*2];return s/t}var at=class{constructor(){this.boundingData=new Float32Array(6)}};function Me(n,e,t,i,s,a){let r=i,c=i+s-1,o=a.pos,p=a.axis*2;for(;;){for(;r<=c&&t[r*6+p]<o;)r++;for(;r<=c&&t[c*6+p]>=o;)c--;if(r<c){for(let f=0;f<3;f++){let u=e[r*3+f];e[r*3+f]=e[c*3+f],e[c*3+f]=u}for(let f=0;f<6;f++){let u=t[r*6+f];t[r*6+f]=t[c*6+f],t[c*6+f]=u}r++,c--}else return r}}function Le(n,e,t,i,s,a){let r=i,c=i+s-1,o=a.pos,p=a.axis*2;for(;;){for(;r<=c&&t[r*6+p]<o;)r++;for(;r<=c&&t[c*6+p]>=o;)c--;if(r<c){let f=n[r];n[r]=n[c],n[c]=f;for(let u=0;u<6;u++){let l=t[r*6+u];t[r*6+u]=t[c*6+u],t[c*6+u]=l}r++,c--}else return r}}function C(n,e){return e[n+15]===65535}function V(n,e){return e[n+6]}function z(n,e){return e[n+14]}function O(n){return n+8}function H(n,e){return e[n+6]}function Vt(n,e){return e[n+7]}var Ce,gt,zt,Re,Pn=Math.pow(2,32);function Ot(n){return"count"in n?1:1+Ot(n.left)+Ot(n.right)}function Ue(n,e,t){return Ce=new Float32Array(t),gt=new Uint32Array(t),zt=new Uint16Array(t),Re=new Uint8Array(t),ae(n,e)}function ae(n,e){let t=n/4,i=n/2,s="count"in e,a=e.boundingData;for(let r=0;r<6;r++)Ce[t+r]=a[r];if(s)if(e.buffer){let r=e.buffer;Re.set(new Uint8Array(r),n);for(let c=n,o=n+r.byteLength;c<o;c+=32){let p=c/2;C(p,zt)||(gt[c/4+6]+=t)}return n+r.byteLength}else{let r=e.offset,c=e.count;return gt[t+6]=r,zt[i+14]=c,zt[i+15]=65535,n+32}else{let r=e.left,c=e.right,o=e.splitAxis,p;if(p=ae(n+32,r),p/4>Pn)throw new Error("MeshBVH: Cannot store child pointer greater than 32 bits.");return gt[t+6]=p/4,p=ae(p,c),gt[t+7]=o,p}}function Sn(n,e){let t=(n.index?n.index.count:n.attributes.position.count)/3,i=t>2**16,s=i?4:2,a=e?new SharedArrayBuffer(t*s):new ArrayBuffer(t*s),r=i?new Uint32Array(a):new Uint16Array(a);for(let c=0,o=r.length;c<o;c++)r[c]=c;return r}function En(n,e,t,i,s){let{maxDepth:a,verbose:r,maxLeafTris:c,strategy:o,onProgress:p,indirect:f}=s,u=n._indirectBuffer,l=n.geometry,m=l.index?l.index.array:null,w=f?Le:Me,b=Z(l),y=new Float32Array(6),x=!1,d=new at;return Rt(e,t,i,d.boundingData,y),A(d,t,i,y),d;function h(T){p&&p(T/b)}function A(T,B,g,_=null,v=0){if(!x&&v>=a&&(x=!0,r&&(console.warn(`MeshBVH: Max depth of ${a} reached when generating BVH. Consider increasing maxDepth.`),console.warn(l))),g<=c||v>=a)return h(B+g),T.offset=B,T.count=g,T;let S=Fe(T.boundingData,_,e,B,g,o);if(S.axis===-1)return h(B+g),T.offset=B,T.count=g,T;let E=w(u,m,e,B,g,S);if(E===B||E===B+g)h(B+g),T.offset=B,T.count=g;else{T.splitAxis=S.axis;let P=new at,D=B,I=E-B;T.left=P,Rt(e,D,I,P.boundingData,y),A(P,D,I,y,v+1);let F=new at,U=E,$=g-I;T.right=F,Rt(e,U,$,F.boundingData,y),A(F,U,$,y,v+1)}return T}}function Ve(n,e){let t=n.geometry;e.indirect&&(n._indirectBuffer=Sn(t,e.useSharedArrayBuffer),Ee(t,e.range)&&!e.verbose&&console.warn('MeshBVH: Provided geometry contains groups or a range that do not fully span the vertex contents while using the "indirect" option. BVH may incorrectly report intersections on unrendered portions of the geometry.')),n._indirectBuffer||Se(t,e);let i=e.useSharedArrayBuffer?SharedArrayBuffer:ArrayBuffer,s=De(t),a=e.indirect?ie(t,e.range):re(t,e.range);n._roots=a.map(r=>{let c=En(n,s,r.offset,r.count,e),o=Ot(c),p=new i(32*o);return Ue(0,c,p),p})}import{Vector3 as Q,Matrix4 as Oe,Line3 as He}from"./three.module.js";import{Vector3 as Dn}from"./three.module.js";var G=class{constructor(){this.min=1/0,this.max=-1/0}setFromPointsField(e,t){let i=1/0,s=-1/0;for(let a=0,r=e.length;a<r;a++){let o=e[a][t];i=o<i?o:i,s=o>s?o:s}this.min=i,this.max=s}setFromPoints(e,t){let i=1/0,s=-1/0;for(let a=0,r=t.length;a<r;a++){let c=t[a],o=e.dot(c);i=o<i?o:i,s=o>s?o:s}this.min=i,this.max=s}isSeparated(e){return this.min>e.max||e.min>this.max}};G.prototype.setFromBox=(function(){let n=new Dn;return function(t,i){let s=i.min,a=i.max,r=1/0,c=-1/0;for(let o=0;o<=1;o++)for(let p=0;p<=1;p++)for(let f=0;f<=1;f++){n.x=s.x*o+a.x*(1-o),n.y=s.y*p+a.y*(1-p),n.z=s.z*f+a.z*(1-f);let u=t.dot(n);r=Math.min(u,r),c=Math.max(u,c)}this.min=r,this.max=c}})();var Vi=(function(){let n=new G;return function(t,i){let s=t.points,a=t.satAxes,r=t.satBounds,c=i.points,o=i.satAxes,p=i.satBounds;for(let f=0;f<3;f++){let u=r[f],l=a[f];if(n.setFromPoints(l,c),u.isSeparated(n))return!1}for(let f=0;f<3;f++){let u=p[f],l=o[f];if(n.setFromPoints(l,s),u.isSeparated(n))return!1}}})();import{Triangle as Ln,Vector3 as X,Line3 as lt,Sphere as Cn,Plane as Rn}from"./three.module.js";import{Vector3 as it,Vector2 as In,Plane as Nn,Line3 as Fn}from"./three.module.js";var Mn=(function(){let n=new it,e=new it,t=new it;return function(s,a,r){let c=s.start,o=n,p=a.start,f=e;t.subVectors(c,p),n.subVectors(s.end,s.start),e.subVectors(a.end,a.start);let u=t.dot(f),l=f.dot(o),m=f.dot(f),w=t.dot(o),y=o.dot(o)*m-l*l,x,d;y!==0?x=(u*l-w*m)/y:x=0,d=(u+x*l)/m,r.x=x,r.y=d}})(),vt=(function(){let n=new In,e=new it,t=new it;return function(s,a,r,c){Mn(s,a,n);let o=n.x,p=n.y;if(o>=0&&o<=1&&p>=0&&p<=1){s.at(o,r),a.at(p,c);return}else if(o>=0&&o<=1){p<0?a.at(0,c):a.at(1,c),s.closestPointToPoint(c,!0,r);return}else if(p>=0&&p<=1){o<0?s.at(0,r):s.at(1,r),a.closestPointToPoint(r,!0,c);return}else{let f;o<0?f=s.start:f=s.end;let u;p<0?u=a.start:u=a.end;let l=e,m=t;if(s.closestPointToPoint(u,!0,e),a.closestPointToPoint(f,!0,t),l.distanceToSquared(u)<=m.distanceToSquared(f)){r.copy(l),c.copy(u);return}else{r.copy(f),c.copy(m);return}}}})(),ze=(function(){let n=new it,e=new it,t=new Nn,i=new Fn;return function(a,r){let{radius:c,center:o}=a,{a:p,b:f,c:u}=r;if(i.start=p,i.end=f,i.closestPointToPoint(o,!0,n).distanceTo(o)<=c||(i.start=p,i.end=u,i.closestPointToPoint(o,!0,n).distanceTo(o)<=c)||(i.start=f,i.end=u,i.closestPointToPoint(o,!0,n).distanceTo(o)<=c))return!0;let b=r.getPlane(t);if(Math.abs(b.distanceToPoint(o))<=c){let x=b.projectPoint(o,e);if(r.containsPoint(x))return!0}return!1}})();var Un=1e-15;function le(n){return Math.abs(n)<Un}var k=class extends Ln{constructor(...e){super(...e),this.isExtendedTriangle=!0,this.satAxes=new Array(4).fill().map(()=>new X),this.satBounds=new Array(4).fill().map(()=>new G),this.points=[this.a,this.b,this.c],this.sphere=new Cn,this.plane=new Rn,this.needsUpdate=!0}intersectsSphere(e){return ze(e,this)}update(){let e=this.a,t=this.b,i=this.c,s=this.points,a=this.satAxes,r=this.satBounds,c=a[0],o=r[0];this.getNormal(c),o.setFromPoints(c,s);let p=a[1],f=r[1];p.subVectors(e,t),f.setFromPoints(p,s);let u=a[2],l=r[2];u.subVectors(t,i),l.setFromPoints(u,s);let m=a[3],w=r[3];m.subVectors(i,e),w.setFromPoints(m,s),this.sphere.setFromPoints(this.points),this.plane.setFromNormalAndCoplanarPoint(c,e),this.needsUpdate=!1}};k.prototype.closestPointToSegment=(function(){let n=new X,e=new X,t=new lt;return function(s,a=null,r=null){let{start:c,end:o}=s,p=this.points,f,u=1/0;for(let l=0;l<3;l++){let m=(l+1)%3;t.start.copy(p[l]),t.end.copy(p[m]),vt(t,s,n,e),f=n.distanceToSquared(e),f<u&&(u=f,a&&a.copy(n),r&&r.copy(e))}return this.closestPointToPoint(c,n),f=c.distanceToSquared(n),f<u&&(u=f,a&&a.copy(n),r&&r.copy(c)),this.closestPointToPoint(o,n),f=o.distanceToSquared(n),f<u&&(u=f,a&&a.copy(n),r&&r.copy(o)),Math.sqrt(u)}})();k.prototype.intersectsTriangle=(function(){let n=new k,e=new Array(3),t=new Array(3),i=new G,s=new G,a=new X,r=new X,c=new X,o=new X,p=new X,f=new lt,u=new lt,l=new lt,m=new X;function w(b,y,x){let d=b.points,h=0,A=-1;for(let T=0;T<3;T++){let{start:B,end:g}=f;B.copy(d[T]),g.copy(d[(T+1)%3]),f.delta(r);let _=le(y.distanceToPoint(B));if(le(y.normal.dot(r))&&_){x.copy(f),h=2;break}let v=y.intersectLine(f,m);if(!v&&_&&m.copy(B),(v||_)&&!le(m.distanceTo(g))){if(h<=1)(h===1?x.start:x.end).copy(m),_&&(A=h);else if(h>=2){(A===1?x.start:x.end).copy(m),h=2;break}if(h++,h===2&&A===-1)break}}return h}return function(y,x=null,d=!1){this.needsUpdate&&this.update(),y.isExtendedTriangle?y.needsUpdate&&y.update():(n.copy(y),n.update(),y=n);let h=this.plane,A=y.plane;if(Math.abs(h.normal.dot(A.normal))>1-1e-10){let T=this.satBounds,B=this.satAxes;t[0]=y.a,t[1]=y.b,t[2]=y.c;for(let v=0;v<4;v++){let S=T[v],E=B[v];if(i.setFromPoints(E,t),S.isSeparated(i))return!1}let g=y.satBounds,_=y.satAxes;e[0]=this.a,e[1]=this.b,e[2]=this.c;for(let v=0;v<4;v++){let S=g[v],E=_[v];if(i.setFromPoints(E,e),S.isSeparated(i))return!1}for(let v=0;v<4;v++){let S=B[v];for(let E=0;E<4;E++){let P=_[E];if(a.crossVectors(S,P),i.setFromPoints(a,e),s.setFromPoints(a,t),i.isSeparated(s))return!1}}return x&&(d||console.warn("ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0."),x.start.set(0,0,0),x.end.set(0,0,0)),!0}else{let T=w(this,A,u);if(T===1&&y.containsPoint(u.end))return x&&(x.start.copy(u.end),x.end.copy(u.end)),!0;if(T!==2)return!1;let B=w(y,h,l);if(B===1&&this.containsPoint(l.end))return x&&(x.start.copy(l.end),x.end.copy(l.end)),!0;if(B!==2)return!1;if(u.delta(c),l.delta(o),c.dot(o)<0){let D=l.start;l.start=l.end,l.end=D}let g=u.start.dot(c),_=u.end.dot(c),v=l.start.dot(c),S=l.end.dot(c),E=_<v,P=g<S;return g!==S&&v!==_&&E===P?!1:(x&&(p.subVectors(u.start,l.start),p.dot(c)>0?x.start.copy(u.start):x.start.copy(l.start),p.subVectors(u.end,l.end),p.dot(c)<0?x.end.copy(u.end):x.end.copy(l.end)),!0)}}})();k.prototype.distanceToPoint=(function(){let n=new X;return function(t){return this.closestPointToPoint(t,n),t.distanceTo(n)}})();k.prototype.distanceToTriangle=(function(){let n=new X,e=new X,t=["a","b","c"],i=new lt,s=new lt;return function(r,c=null,o=null){let p=c||o?i:null;if(this.intersectsTriangle(r,p))return(c||o)&&(c&&p.getCenter(c),o&&p.getCenter(o)),0;let f=1/0;for(let u=0;u<3;u++){let l,m=t[u],w=r[m];this.closestPointToPoint(w,n),l=w.distanceToSquared(n),l<f&&(f=l,c&&c.copy(n),o&&o.copy(w));let b=this[m];r.closestPointToPoint(b,n),l=b.distanceToSquared(n),l<f&&(f=l,c&&c.copy(b),o&&o.copy(n))}for(let u=0;u<3;u++){let l=t[u],m=t[(u+1)%3];i.set(this[l],this[m]);for(let w=0;w<3;w++){let b=t[w],y=t[(w+1)%3];s.set(r[b],r[y]),vt(i,s,n,e);let x=n.distanceToSquared(e);x<f&&(f=x,c&&c.copy(n),o&&o.copy(e))}}return Math.sqrt(f)}})();var R=class{constructor(e,t,i){this.isOrientedBox=!0,this.min=new Q,this.max=new Q,this.matrix=new Oe,this.invMatrix=new Oe,this.points=new Array(8).fill().map(()=>new Q),this.satAxes=new Array(3).fill().map(()=>new Q),this.satBounds=new Array(3).fill().map(()=>new G),this.alignedSatBounds=new Array(3).fill().map(()=>new G),this.needsUpdate=!1,e&&this.min.copy(e),t&&this.max.copy(t),i&&this.matrix.copy(i)}set(e,t,i){this.min.copy(e),this.max.copy(t),this.matrix.copy(i),this.needsUpdate=!0}copy(e){this.min.copy(e.min),this.max.copy(e.max),this.matrix.copy(e.matrix),this.needsUpdate=!0}};R.prototype.update=(function(){return function(){let e=this.matrix,t=this.min,i=this.max,s=this.points;for(let p=0;p<=1;p++)for(let f=0;f<=1;f++)for(let u=0;u<=1;u++){let l=1*p|2*f|4*u,m=s[l];m.x=p?i.x:t.x,m.y=f?i.y:t.y,m.z=u?i.z:t.z,m.applyMatrix4(e)}let a=this.satBounds,r=this.satAxes,c=s[0];for(let p=0;p<3;p++){let f=r[p],u=a[p],l=1<<p,m=s[l];f.subVectors(c,m),u.setFromPoints(f,s)}let o=this.alignedSatBounds;o[0].setFromPointsField(s,"x"),o[1].setFromPointsField(s,"y"),o[2].setFromPointsField(s,"z"),this.invMatrix.copy(this.matrix).invert(),this.needsUpdate=!1}})();R.prototype.intersectsBox=(function(){let n=new G;return function(t){this.needsUpdate&&this.update();let i=t.min,s=t.max,a=this.satBounds,r=this.satAxes,c=this.alignedSatBounds;if(n.min=i.x,n.max=s.x,c[0].isSeparated(n)||(n.min=i.y,n.max=s.y,c[1].isSeparated(n))||(n.min=i.z,n.max=s.z,c[2].isSeparated(n)))return!1;for(let o=0;o<3;o++){let p=r[o],f=a[o];if(n.setFromBox(p,t),f.isSeparated(n))return!1}return!0}})();R.prototype.intersectsTriangle=(function(){let n=new k,e=new Array(3),t=new G,i=new G,s=new Q;return function(r){this.needsUpdate&&this.update(),r.isExtendedTriangle?r.needsUpdate&&r.update():(n.copy(r),n.update(),r=n);let c=this.satBounds,o=this.satAxes;e[0]=r.a,e[1]=r.b,e[2]=r.c;for(let l=0;l<3;l++){let m=c[l],w=o[l];if(t.setFromPoints(w,e),m.isSeparated(t))return!1}let p=r.satBounds,f=r.satAxes,u=this.points;for(let l=0;l<3;l++){let m=p[l],w=f[l];if(t.setFromPoints(w,u),m.isSeparated(t))return!1}for(let l=0;l<3;l++){let m=o[l];for(let w=0;w<4;w++){let b=f[w];if(s.crossVectors(m,b),t.setFromPoints(s,e),i.setFromPoints(s,u),t.isSeparated(i))return!1}}return!0}})();R.prototype.closestPointToPoint=(function(){return function(e,t){return this.needsUpdate&&this.update(),t.copy(e).applyMatrix4(this.invMatrix).clamp(this.min,this.max).applyMatrix4(this.matrix),t}})();R.prototype.distanceToPoint=(function(){let n=new Q;return function(t){return this.closestPointToPoint(t,n),t.distanceTo(n)}})();R.prototype.distanceToBox=(function(){let n=["x","y","z"],e=new Array(12).fill().map(()=>new He),t=new Array(12).fill().map(()=>new He),i=new Q,s=new Q;return function(r,c=0,o=null,p=null){if(this.needsUpdate&&this.update(),this.intersectsBox(r))return(o||p)&&(r.getCenter(s),this.closestPointToPoint(s,i),r.closestPointToPoint(i,s),o&&o.copy(i),p&&p.copy(s)),0;let f=c*c,u=r.min,l=r.max,m=this.points,w=1/0;for(let y=0;y<8;y++){let x=m[y];s.copy(x).clamp(u,l);let d=x.distanceToSquared(s);if(d<w&&(w=d,o&&o.copy(x),p&&p.copy(s),d<f))return Math.sqrt(d)}let b=0;for(let y=0;y<3;y++)for(let x=0;x<=1;x++)for(let d=0;d<=1;d++){let h=(y+1)%3,A=(y+2)%3,T=x<<h|d<<A,B=1<<y|x<<h|d<<A,g=m[T],_=m[B];e[b].set(g,_);let S=n[y],E=n[h],P=n[A],D=t[b],I=D.start,F=D.end;I[S]=u[S],I[E]=x?u[E]:l[E],I[P]=d?u[P]:l[E],F[S]=l[S],F[E]=x?u[E]:l[E],F[P]=d?u[P]:l[E],b++}for(let y=0;y<=1;y++)for(let x=0;x<=1;x++)for(let d=0;d<=1;d++){s.x=y?l.x:u.x,s.y=x?l.y:u.y,s.z=d?l.z:u.z,this.closestPointToPoint(s,i);let h=s.distanceToSquared(i);if(h<w&&(w=h,o&&o.copy(i),p&&p.copy(s),h<f))return Math.sqrt(h)}for(let y=0;y<12;y++){let x=e[y];for(let d=0;d<12;d++){let h=t[d];vt(x,h,i,s);let A=i.distanceToSquared(s);if(A<w&&(w=A,o&&o.copy(i),p&&p.copy(s),A<f))return Math.sqrt(A)}}return Math.sqrt(w)}})();var tt=class{constructor(e){this._getNewPrimitive=e,this._primitives=[]}getPrimitive(){let e=this._primitives;return e.length===0?this._getNewPrimitive():e.pop()}releasePrimitive(e){this._primitives.push(e)}};var fe=class extends tt{constructor(){super(()=>new k)}},q=new fe;import{Box3 as zn}from"./three.module.js";var ue=class{constructor(){this.float32Array=null,this.uint16Array=null,this.uint32Array=null;let e=[],t=null;this.setBuffer=i=>{t&&e.push(t),t=i,this.float32Array=new Float32Array(i),this.uint16Array=new Uint16Array(i),this.uint32Array=new Uint32Array(i)},this.clearBuffer=()=>{t=null,this.float32Array=null,this.uint16Array=null,this.uint32Array=null,e.length!==0&&this.setBuffer(e.pop())}}},N=new ue;var et,ut,ft=[],kt=new tt(()=>new zn);function ke(n,e,t,i,s,a){et=kt.getPrimitive(),ut=kt.getPrimitive(),ft.push(et,ut),N.setBuffer(n._roots[e]);let r=pe(0,n.geometry,t,i,s,a);N.clearBuffer(),kt.releasePrimitive(et),kt.releasePrimitive(ut),ft.pop(),ft.pop();let c=ft.length;return c>0&&(ut=ft[c-1],et=ft[c-2]),r}function pe(n,e,t,i,s=null,a=0,r=0){let{float32Array:c,uint16Array:o,uint32Array:p}=N,f=n*2;if(C(f,o)){let l=V(n,p),m=z(f,o);return M(n,c,et),i(l,m,!1,r,a+n,et)}else{let S=function(P){let{uint16Array:D,uint32Array:I}=N,F=P*2;for(;!C(F,D);)P=O(P),F=P*2;return V(P,I)},E=function(P){let{uint16Array:D,uint32Array:I}=N,F=P*2;for(;!C(F,D);)P=H(P,I),F=P*2;return V(P,I)+z(F,D)},l=O(n),m=H(n,p),w=l,b=m,y,x,d,h;if(s&&(d=et,h=ut,M(w,c,d),M(b,c,h),y=s(d),x=s(h),x<y)){w=m,b=l;let P=y;y=x,x=P,d=h}d||(d=et,M(w,c,d));let A=C(w*2,o),T=t(d,A,y,r+1,a+w),B;if(T===2){let P=S(w),I=E(w)-P;B=i(P,I,!0,r+1,a+w,d)}else B=T&&pe(w,e,t,i,s,a,r+1);if(B)return!0;h=ut,M(b,c,h);let g=C(b*2,o),_=t(h,g,x,r+1,a+b),v;if(_===2){let P=S(b),I=E(b)-P;v=i(P,I,!0,r+1,a+b,h)}else v=_&&pe(b,e,t,i,s,a,r+1);return!!v}}import{Vector3 as qe}from"./three.module.js";var _t=new qe,de=new qe;function Ge(n,e,t={},i=0,s=1/0){let a=i*i,r=s*s,c=1/0,o=null;if(n.shapecast({boundsTraverseOrder:f=>(_t.copy(e).clamp(f.min,f.max),_t.distanceToSquared(e)),intersectsBounds:(f,u,l)=>l<c&&l<r,intersectsTriangle:(f,u)=>{f.closestPointToPoint(e,_t);let l=e.distanceToSquared(_t);return l<c&&(de.copy(_t),c=l,o=u),l<a}}),c===1/0)return null;let p=Math.sqrt(c);return t.point?t.point.copy(de):t.point=de.clone(),t.distance=p,t.faceIndex=o,t}import{Vector3 as K,Vector2 as Et,Triangle as Pt,DoubleSide as On,BackSide as Hn,REVISION as kn}from"./three.module.js";var qn=parseInt(kn)>=169,rt=new K,st=new K,ot=new K,qt=new Et,Gt=new Et,Xt=new Et,Xe=new K,Ye=new K,je=new K,St=new K;function Gn(n,e,t,i,s,a,r,c){let o;if(a===Hn?o=n.intersectTriangle(i,t,e,!0,s):o=n.intersectTriangle(e,t,i,a!==On,s),o===null)return null;let p=n.origin.distanceTo(s);return p<r||p>c?null:{distance:p,point:s.clone()}}function Xn(n,e,t,i,s,a,r,c,o,p,f){rt.fromBufferAttribute(e,a),st.fromBufferAttribute(e,r),ot.fromBufferAttribute(e,c);let u=Gn(n,rt,st,ot,St,o,p,f);if(u){let l=new K;Pt.getBarycoord(St,rt,st,ot,l),i&&(qt.fromBufferAttribute(i,a),Gt.fromBufferAttribute(i,r),Xt.fromBufferAttribute(i,c),u.uv=Pt.getInterpolation(St,rt,st,ot,qt,Gt,Xt,new Et)),s&&(qt.fromBufferAttribute(s,a),Gt.fromBufferAttribute(s,r),Xt.fromBufferAttribute(s,c),u.uv1=Pt.getInterpolation(St,rt,st,ot,qt,Gt,Xt,new Et)),t&&(Xe.fromBufferAttribute(t,a),Ye.fromBufferAttribute(t,r),je.fromBufferAttribute(t,c),u.normal=Pt.getInterpolation(St,rt,st,ot,Xe,Ye,je,new K),u.normal.dot(n.direction)>0&&u.normal.multiplyScalar(-1));let m={a,b:r,c,normal:new K,materialIndex:0};Pt.getNormal(rt,st,ot,m.normal),u.face=m,u.faceIndex=a,qn&&(u.barycoord=l)}return u}function pt(n,e,t,i,s,a,r){let c=i*3,o=c+0,p=c+1,f=c+2,u=n.index;n.index&&(o=u.getX(o),p=u.getX(p),f=u.getX(f));let{position:l,normal:m,uv:w,uv1:b}=n.attributes,y=Xn(t,l,m,w,b,o,p,f,e,a,r);return y?(y.faceIndex=i,s&&s.push(y),y):null}import{Vector2 as mr,Vector3 as dr,Triangle as xr}from"./three.module.js";function L(n,e,t,i){let s=n.a,a=n.b,r=n.c,c=e,o=e+1,p=e+2;t&&(c=t.getX(c),o=t.getX(o),p=t.getX(p)),s.x=i.getX(c),s.y=i.getY(c),s.z=i.getZ(c),a.x=i.getX(o),a.y=i.getY(o),a.z=i.getZ(o),r.x=i.getX(p),r.y=i.getY(p),r.z=i.getZ(p)}function Ze(n,e,t,i,s,a,r,c){let{geometry:o,_indirectBuffer:p}=n;for(let f=i,u=i+s;f<u;f++)pt(o,e,t,f,a,r,c)}function Ke(n,e,t,i,s,a,r){let{geometry:c,_indirectBuffer:o}=n,p=1/0,f=null;for(let u=i,l=i+s;u<l;u++){let m;m=pt(c,e,t,u,null,a,r),m&&m.distance<p&&(f=m,p=m.distance)}return f}function We(n,e,t,i,s,a,r){let{geometry:c}=t,{index:o}=c,p=c.attributes.position;for(let f=n,u=e+n;f<u;f++){let l;if(l=f,L(r,l*3,o,p),r.needsUpdate=!0,i(r,l,s,a))return!0}return!1}function $e(n,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=n.geometry,i=t.index?t.index.array:null,s=t.attributes.position,a,r,c,o,p=0,f=n._roots;for(let l=0,m=f.length;l<m;l++)a=f[l],r=new Uint32Array(a),c=new Uint16Array(a),o=new Float32Array(a),u(0,p),p+=a.byteLength;function u(l,m,w=!1){let b=l*2;if(c[b+15]===65535){let x=r[l+6],d=c[b+14],h=1/0,A=1/0,T=1/0,B=-1/0,g=-1/0,_=-1/0;for(let v=3*x,S=3*(x+d);v<S;v++){let E=i[v],P=s.getX(E),D=s.getY(E),I=s.getZ(E);P<h&&(h=P),P>B&&(B=P),D<A&&(A=D),D>g&&(g=D),I<T&&(T=I),I>_&&(_=I)}return o[l+0]!==h||o[l+1]!==A||o[l+2]!==T||o[l+3]!==B||o[l+4]!==g||o[l+5]!==_?(o[l+0]=h,o[l+1]=A,o[l+2]=T,o[l+3]=B,o[l+4]=g,o[l+5]=_,!0):!1}else{let x=l+8,d=r[l+6],h=x+m,A=d+m,T=w,B=!1,g=!1;e?T||(B=e.has(h),g=e.has(A),T=!B&&!g):(B=!0,g=!0);let _=T||B,v=T||g,S=!1;_&&(S=u(x,m,T));let E=!1;v&&(E=u(d,m,T));let P=S||E;if(P)for(let D=0;D<3;D++){let I=x+D,F=d+D,U=o[I],$=o[I+3],At=o[F],wt=o[F+3];o[l+D]=U<At?U:At,o[l+D+3]=$>wt?$:wt}return P}}}function Y(n,e,t,i,s){let a,r,c,o,p,f,u=1/t.direction.x,l=1/t.direction.y,m=1/t.direction.z,w=t.origin.x,b=t.origin.y,y=t.origin.z,x=e[n],d=e[n+3],h=e[n+1],A=e[n+3+1],T=e[n+2],B=e[n+3+2];return u>=0?(a=(x-w)*u,r=(d-w)*u):(a=(d-w)*u,r=(x-w)*u),l>=0?(c=(h-b)*l,o=(A-b)*l):(c=(A-b)*l,o=(h-b)*l),a>o||c>r||((c>a||isNaN(a))&&(a=c),(o<r||isNaN(r))&&(r=o),m>=0?(p=(T-y)*m,f=(B-y)*m):(p=(B-y)*m,f=(T-y)*m),a>f||p>r)?!1:((p>a||a!==a)&&(a=p),(f<r||r!==r)&&(r=f),a<=s&&r>=i)}function Je(n,e,t,i,s,a,r,c){let{geometry:o,_indirectBuffer:p}=n;for(let f=i,u=i+s;f<u;f++){let l=p?p[f]:f;pt(o,e,t,l,a,r,c)}}function Qe(n,e,t,i,s,a,r){let{geometry:c,_indirectBuffer:o}=n,p=1/0,f=null;for(let u=i,l=i+s;u<l;u++){let m;m=pt(c,e,t,o?o[u]:u,null,a,r),m&&m.distance<p&&(f=m,p=m.distance)}return f}function tn(n,e,t,i,s,a,r){let{geometry:c}=t,{index:o}=c,p=c.attributes.position;for(let f=n,u=e+n;f<u;f++){let l;if(l=t.resolveTriangleIndex(f),L(r,l*3,o,p),r.needsUpdate=!0,i(r,l,s,a))return!0}return!1}function en(n,e,t,i,s,a,r){N.setBuffer(n._roots[e]),xe(0,n,t,i,s,a,r),N.clearBuffer()}function xe(n,e,t,i,s,a,r){let{float32Array:c,uint16Array:o,uint32Array:p}=N,f=n*2;if(C(f,o)){let l=V(n,p),m=z(f,o);Ze(e,t,i,l,m,s,a,r)}else{let l=O(n);Y(l,c,i,a,r)&&xe(l,e,t,i,s,a,r);let m=H(n,p);Y(m,c,i,a,r)&&xe(m,e,t,i,s,a,r)}}var Yn=["x","y","z"];function nn(n,e,t,i,s,a){N.setBuffer(n._roots[e]);let r=ye(0,n,t,i,s,a);return N.clearBuffer(),r}function ye(n,e,t,i,s,a){let{float32Array:r,uint16Array:c,uint32Array:o}=N,p=n*2;if(C(p,c)){let u=V(n,o),l=z(p,c);return Ke(e,t,i,u,l,s,a)}else{let u=Vt(n,o),l=Yn[u],w=i.direction[l]>=0,b,y;w?(b=O(n),y=H(n,o)):(b=H(n,o),y=O(n));let d=Y(b,r,i,s,a)?ye(b,e,t,i,s,a):null;if(d){let T=d.point[l];if(w?T<=r[y+u]:T>=r[y+u+3])return d}let A=Y(y,r,i,s,a)?ye(y,e,t,i,s,a):null;return d&&A?d.distance<=A.distance?d:A:d||A||null}}import{Box3 as jn,Matrix4 as Zn}from"./three.module.js";var Yt=new jn,mt=new k,dt=new k,Dt=new Zn,rn=new R,jt=new R;function sn(n,e,t,i){N.setBuffer(n._roots[e]);let s=he(0,n,t,i);return N.clearBuffer(),s}function he(n,e,t,i,s=null){let{float32Array:a,uint16Array:r,uint32Array:c}=N,o=n*2;if(s===null&&(t.boundingBox||t.computeBoundingBox(),rn.set(t.boundingBox.min,t.boundingBox.max,i),s=rn),C(o,r)){let f=e.geometry,u=f.index,l=f.attributes.position,m=t.index,w=t.attributes.position,b=V(n,c),y=z(o,r);if(Dt.copy(i).invert(),t.boundsTree)return M(n,a,jt),jt.matrix.copy(Dt),jt.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:d=>jt.intersectsBox(d),intersectsTriangle:d=>{d.a.applyMatrix4(i),d.b.applyMatrix4(i),d.c.applyMatrix4(i),d.needsUpdate=!0;for(let h=b*3,A=(y+b)*3;h<A;h+=3)if(L(dt,h,u,l),dt.needsUpdate=!0,d.intersectsTriangle(dt))return!0;return!1}});for(let x=b*3,d=(y+b)*3;x<d;x+=3){L(mt,x,u,l),mt.a.applyMatrix4(Dt),mt.b.applyMatrix4(Dt),mt.c.applyMatrix4(Dt),mt.needsUpdate=!0;for(let h=0,A=m.count;h<A;h+=3)if(L(dt,h,m,w),dt.needsUpdate=!0,mt.intersectsTriangle(dt))return!0}}else{let f=n+8,u=c[n+6];return M(f,a,Yt),!!(s.intersectsBox(Yt)&&he(f,e,t,i,s)||(M(u,a,Yt),s.intersectsBox(Yt)&&he(u,e,t,i,s)))}}import{Matrix4 as Kn,Vector3 as Kt}from"./three.module.js";var Zt=new Kn,Te=new R,It=new R,Wn=new Kt,$n=new Kt,Jn=new Kt,Qn=new Kt;function on(n,e,t,i={},s={},a=0,r=1/0){e.boundingBox||e.computeBoundingBox(),Te.set(e.boundingBox.min,e.boundingBox.max,t),Te.needsUpdate=!0;let c=n.geometry,o=c.attributes.position,p=c.index,f=e.attributes.position,u=e.index,l=q.getPrimitive(),m=q.getPrimitive(),w=Wn,b=$n,y=null,x=null;s&&(y=Jn,x=Qn);let d=1/0,h=null,A=null;return Zt.copy(t).invert(),It.matrix.copy(Zt),n.shapecast({boundsTraverseOrder:T=>Te.distanceToBox(T),intersectsBounds:(T,B,g)=>g<d&&g<r?(B&&(It.min.copy(T.min),It.max.copy(T.max),It.needsUpdate=!0),!0):!1,intersectsRange:(T,B)=>{if(e.boundsTree)return e.boundsTree.shapecast({boundsTraverseOrder:_=>It.distanceToBox(_),intersectsBounds:(_,v,S)=>S<d&&S<r,intersectsRange:(_,v)=>{for(let S=_,E=_+v;S<E;S++){L(m,3*S,u,f),m.a.applyMatrix4(t),m.b.applyMatrix4(t),m.c.applyMatrix4(t),m.needsUpdate=!0;for(let P=T,D=T+B;P<D;P++){L(l,3*P,p,o),l.needsUpdate=!0;let I=l.distanceToTriangle(m,w,y);if(I<d&&(b.copy(w),x&&x.copy(y),d=I,h=P,A=S),I<a)return!0}}}});{let g=Z(e);for(let _=0,v=g;_<v;_++){L(m,3*_,u,f),m.a.applyMatrix4(t),m.b.applyMatrix4(t),m.c.applyMatrix4(t),m.needsUpdate=!0;for(let S=T,E=T+B;S<E;S++){L(l,3*S,p,o),l.needsUpdate=!0;let P=l.distanceToTriangle(m,w,y);if(P<d&&(b.copy(w),x&&x.copy(y),d=P,h=S,A=_),P<a)return!0}}}}}),q.releasePrimitive(l),q.releasePrimitive(m),d===1/0?null:(i.point?i.point.copy(b):i.point=b.clone(),i.distance=d,i.faceIndex=h,s&&(s.point?s.point.copy(x):s.point=x.clone(),s.point.applyMatrix4(Zt),b.applyMatrix4(Zt),s.distance=b.sub(s.point).length(),s.faceIndex=A),i)}function cn(n,e=null){e&&Array.isArray(e)&&(e=new Set(e));let t=n.geometry,i=t.index?t.index.array:null,s=t.attributes.position,a,r,c,o,p=0,f=n._roots;for(let l=0,m=f.length;l<m;l++)a=f[l],r=new Uint32Array(a),c=new Uint16Array(a),o=new Float32Array(a),u(0,p),p+=a.byteLength;function u(l,m,w=!1){let b=l*2;if(c[b+15]===65535){let x=r[l+6],d=c[b+14],h=1/0,A=1/0,T=1/0,B=-1/0,g=-1/0,_=-1/0;for(let v=x,S=x+d;v<S;v++){let E=3*n.resolveTriangleIndex(v);for(let P=0;P<3;P++){let D=E+P;D=i?i[D]:D;let I=s.getX(D),F=s.getY(D),U=s.getZ(D);I<h&&(h=I),I>B&&(B=I),F<A&&(A=F),F>g&&(g=F),U<T&&(T=U),U>_&&(_=U)}}return o[l+0]!==h||o[l+1]!==A||o[l+2]!==T||o[l+3]!==B||o[l+4]!==g||o[l+5]!==_?(o[l+0]=h,o[l+1]=A,o[l+2]=T,o[l+3]=B,o[l+4]=g,o[l+5]=_,!0):!1}else{let x=l+8,d=r[l+6],h=x+m,A=d+m,T=w,B=!1,g=!1;e?T||(B=e.has(h),g=e.has(A),T=!B&&!g):(B=!0,g=!0);let _=T||B,v=T||g,S=!1;_&&(S=u(x,m,T));let E=!1;v&&(E=u(d,m,T));let P=S||E;if(P)for(let D=0;D<3;D++){let I=x+D,F=d+D,U=o[I],$=o[I+3],At=o[F],wt=o[F+3];o[l+D]=U<At?U:At,o[l+D+3]=$>wt?$:wt}return P}}}function an(n,e,t,i,s,a,r){N.setBuffer(n._roots[e]),Ae(0,n,t,i,s,a,r),N.clearBuffer()}function Ae(n,e,t,i,s,a,r){let{float32Array:c,uint16Array:o,uint32Array:p}=N,f=n*2;if(C(f,o)){let l=V(n,p),m=z(f,o);Je(e,t,i,l,m,s,a,r)}else{let l=O(n);Y(l,c,i,a,r)&&Ae(l,e,t,i,s,a,r);let m=H(n,p);Y(m,c,i,a,r)&&Ae(m,e,t,i,s,a,r)}}var ti=["x","y","z"];function ln(n,e,t,i,s,a){N.setBuffer(n._roots[e]);let r=we(0,n,t,i,s,a);return N.clearBuffer(),r}function we(n,e,t,i,s,a){let{float32Array:r,uint16Array:c,uint32Array:o}=N,p=n*2;if(C(p,c)){let u=V(n,o),l=z(p,c);return Qe(e,t,i,u,l,s,a)}else{let u=Vt(n,o),l=ti[u],w=i.direction[l]>=0,b,y;w?(b=O(n),y=H(n,o)):(b=H(n,o),y=O(n));let d=Y(b,r,i,s,a)?we(b,e,t,i,s,a):null;if(d){let T=d.point[l];if(w?T<=r[y+u]:T>=r[y+u+3])return d}let A=Y(y,r,i,s,a)?we(y,e,t,i,s,a):null;return d&&A?d.distance<=A.distance?d:A:d||A||null}}import{Box3 as ei,Matrix4 as ni}from"./three.module.js";var Wt=new ei,xt=new k,yt=new k,Nt=new ni,fn=new R,$t=new R;function un(n,e,t,i){N.setBuffer(n._roots[e]);let s=be(0,n,t,i);return N.clearBuffer(),s}function be(n,e,t,i,s=null){let{float32Array:a,uint16Array:r,uint32Array:c}=N,o=n*2;if(s===null&&(t.boundingBox||t.computeBoundingBox(),fn.set(t.boundingBox.min,t.boundingBox.max,i),s=fn),C(o,r)){let f=e.geometry,u=f.index,l=f.attributes.position,m=t.index,w=t.attributes.position,b=V(n,c),y=z(o,r);if(Nt.copy(i).invert(),t.boundsTree)return M(n,a,$t),$t.matrix.copy(Nt),$t.needsUpdate=!0,t.boundsTree.shapecast({intersectsBounds:d=>$t.intersectsBox(d),intersectsTriangle:d=>{d.a.applyMatrix4(i),d.b.applyMatrix4(i),d.c.applyMatrix4(i),d.needsUpdate=!0;for(let h=b,A=y+b;h<A;h++)if(L(yt,3*e.resolveTriangleIndex(h),u,l),yt.needsUpdate=!0,d.intersectsTriangle(yt))return!0;return!1}});for(let x=b,d=y+b;x<d;x++){let h=e.resolveTriangleIndex(x);L(xt,3*h,u,l),xt.a.applyMatrix4(Nt),xt.b.applyMatrix4(Nt),xt.c.applyMatrix4(Nt),xt.needsUpdate=!0;for(let A=0,T=m.count;A<T;A+=3)if(L(yt,A,m,w),yt.needsUpdate=!0,xt.intersectsTriangle(yt))return!0}}else{let f=n+8,u=c[n+6];return M(f,a,Wt),!!(s.intersectsBox(Wt)&&be(f,e,t,i,s)||(M(u,a,Wt),s.intersectsBox(Wt)&&be(u,e,t,i,s)))}}import{Matrix4 as ii,Vector3 as Qt}from"./three.module.js";var Jt=new ii,ge=new R,Ft=new R,ri=new Qt,si=new Qt,oi=new Qt,ci=new Qt;function pn(n,e,t,i={},s={},a=0,r=1/0){e.boundingBox||e.computeBoundingBox(),ge.set(e.boundingBox.min,e.boundingBox.max,t),ge.needsUpdate=!0;let c=n.geometry,o=c.attributes.position,p=c.index,f=e.attributes.position,u=e.index,l=q.getPrimitive(),m=q.getPrimitive(),w=ri,b=si,y=null,x=null;s&&(y=oi,x=ci);let d=1/0,h=null,A=null;return Jt.copy(t).invert(),Ft.matrix.copy(Jt),n.shapecast({boundsTraverseOrder:T=>ge.distanceToBox(T),intersectsBounds:(T,B,g)=>g<d&&g<r?(B&&(Ft.min.copy(T.min),Ft.max.copy(T.max),Ft.needsUpdate=!0),!0):!1,intersectsRange:(T,B)=>{if(e.boundsTree){let g=e.boundsTree;return g.shapecast({boundsTraverseOrder:_=>Ft.distanceToBox(_),intersectsBounds:(_,v,S)=>S<d&&S<r,intersectsRange:(_,v)=>{for(let S=_,E=_+v;S<E;S++){let P=g.resolveTriangleIndex(S);L(m,3*P,u,f),m.a.applyMatrix4(t),m.b.applyMatrix4(t),m.c.applyMatrix4(t),m.needsUpdate=!0;for(let D=T,I=T+B;D<I;D++){let F=n.resolveTriangleIndex(D);L(l,3*F,p,o),l.needsUpdate=!0;let U=l.distanceToTriangle(m,w,y);if(U<d&&(b.copy(w),x&&x.copy(y),d=U,h=D,A=S),U<a)return!0}}}})}else{let g=Z(e);for(let _=0,v=g;_<v;_++){L(m,3*_,u,f),m.a.applyMatrix4(t),m.b.applyMatrix4(t),m.c.applyMatrix4(t),m.needsUpdate=!0;for(let S=T,E=T+B;S<E;S++){let P=n.resolveTriangleIndex(S);L(l,3*P,p,o),l.needsUpdate=!0;let D=l.distanceToTriangle(m,w,y);if(D<d&&(b.copy(w),x&&x.copy(y),d=D,h=S,A=_),D<a)return!0}}}}}),q.releasePrimitive(l),q.releasePrimitive(m),d===1/0?null:(i.point?i.point.copy(b):i.point=b.clone(),i.distance=d,i.faceIndex=h,s&&(s.point?s.point.copy(x):s.point=x.clone(),s.point.applyMatrix4(Jt),b.applyMatrix4(Jt),s.distance=b.sub(s.point).length(),s.faceIndex=A),i)}function mn(){return typeof SharedArrayBuffer<"u"}import{Box3 as Lt,Matrix4 as ai}from"./three.module.js";var Mt=new N.constructor,te=new N.constructor,nt=new tt(()=>new Lt),ht=new Lt,Tt=new Lt,Be=new Lt,ve=new Lt,_e=!1;function dn(n,e,t,i){if(_e)throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");_e=!0;let s=n._roots,a=e._roots,r,c=0,o=0,p=new ai().copy(t).invert();for(let f=0,u=s.length;f<u;f++){Mt.setBuffer(s[f]),o=0;let l=nt.getPrimitive();M(0,Mt.float32Array,l),l.applyMatrix4(p);for(let m=0,w=a.length;m<w&&(te.setBuffer(a[m]),r=j(0,0,t,p,i,c,o,0,0,l),te.clearBuffer(),o+=a[m].length,!r);m++);if(nt.releasePrimitive(l),Mt.clearBuffer(),c+=s[f].length,r)break}return _e=!1,r}function j(n,e,t,i,s,a=0,r=0,c=0,o=0,p=null,f=!1){let u,l;f?(u=te,l=Mt):(u=Mt,l=te);let m=u.float32Array,w=u.uint32Array,b=u.uint16Array,y=l.float32Array,x=l.uint32Array,d=l.uint16Array,h=n*2,A=e*2,T=C(h,b),B=C(A,d),g=!1;if(B&&T)f?g=s(V(e,x),z(e*2,d),V(n,w),z(n*2,b),o,r+e,c,a+n):g=s(V(n,w),z(n*2,b),V(e,x),z(e*2,d),c,a+n,o,r+e);else if(B){let _=nt.getPrimitive();M(e,y,_),_.applyMatrix4(t);let v=O(n),S=H(n,w);M(v,m,ht),M(S,m,Tt);let E=_.intersectsBox(ht),P=_.intersectsBox(Tt);g=E&&j(e,v,i,t,s,r,a,o,c+1,_,!f)||P&&j(e,S,i,t,s,r,a,o,c+1,_,!f),nt.releasePrimitive(_)}else{let _=O(e),v=H(e,x);M(_,y,Be),M(v,y,ve);let S=p.intersectsBox(Be),E=p.intersectsBox(ve);if(S&&E)g=j(n,_,t,i,s,a,r,c,o+1,p,f)||j(n,v,t,i,s,a,r,c,o+1,p,f);else if(S)if(T)g=j(n,_,t,i,s,a,r,c,o+1,p,f);else{let P=nt.getPrimitive();P.copy(Be).applyMatrix4(t);let D=O(n),I=H(n,w);M(D,m,ht),M(I,m,Tt);let F=P.intersectsBox(ht),U=P.intersectsBox(Tt);g=F&&j(_,D,i,t,s,r,a,o,c+1,P,!f)||U&&j(_,I,i,t,s,r,a,o,c+1,P,!f),nt.releasePrimitive(P)}else if(E)if(T)g=j(n,v,t,i,s,a,r,c,o+1,p,f);else{let P=nt.getPrimitive();P.copy(ve).applyMatrix4(t);let D=O(n),I=H(n,w);M(D,m,ht),M(I,m,Tt);let F=P.intersectsBox(ht),U=P.intersectsBox(Tt);g=F&&j(v,D,i,t,s,r,a,o,c+1,P,!f)||U&&j(v,I,i,t,s,r,a,o,c+1,P,!f),nt.releasePrimitive(P)}}return g}var ee=new R,yn=new hn,fi={strategy:0,maxDepth:40,maxLeafTris:10,useSharedArrayBuffer:!1,setBoundingBox:!0,onProgress:null,indirect:!1,verbose:!0,range:null},ne=class n{static serialize(e,t={}){t={cloneBuffers:!0,...t};let i=e.geometry,s=e._roots,a=e._indirectBuffer,r=i.getIndex(),c;return t.cloneBuffers?c={roots:s.map(o=>o.slice()),index:r?r.array.slice():null,indirectBuffer:a?a.slice():null}:c={roots:s,index:r?r.array:null,indirectBuffer:a},c}static deserialize(e,t,i={}){i={setIndex:!0,indirect:!!e.indirectBuffer,...i};let{index:s,roots:a,indirectBuffer:r}=e,c=new n(t,{...i,[Ct]:!0});if(c._roots=a,c._indirectBuffer=r||null,i.setIndex){let o=t.getIndex();if(o===null){let p=new li(e.index,1,!1);t.setIndex(p)}else o.array!==s&&(o.array.set(s),o.needsUpdate=!0)}return c}get indirect(){return!!this._indirectBuffer}constructor(e,t={}){if(e.isBufferGeometry){if(e.index&&e.index.isInterleavedBufferAttribute)throw new Error("MeshBVH: InterleavedBufferAttribute is not supported for the index attribute.")}else throw new Error("MeshBVH: Only BufferGeometries are supported.");if(t=Object.assign({...fi,[Ct]:!1},t),t.useSharedArrayBuffer&&!mn())throw new Error("MeshBVH: SharedArrayBuffer is not available.");this.geometry=e,this._roots=null,this._indirectBuffer=null,t[Ct]||(Ve(this,t),!e.boundingBox&&t.setBoundingBox&&(e.boundingBox=this.getBoundingBox(new hn))),this.resolveTriangleIndex=t.indirect?i=>this._indirectBuffer[i]:i=>i}refit(e=null){return(this.indirect?cn:$e)(this,e)}traverse(e,t=0){let i=this._roots[t],s=new Uint32Array(i),a=new Uint16Array(i);r(0);function r(c,o=0){let p=c*2,f=a[p+15]===65535;if(f){let u=s[c+6],l=a[p+14];e(o,f,new Float32Array(i,c*4,6),u,l)}else{let u=c+32/4,l=s[c+6],m=s[c+7];e(o,f,new Float32Array(i,c*4,6),m)||(r(u,o+1),r(l,o+1))}}}raycast(e,t=xn,i=0,s=1/0){let a=this._roots,r=this.geometry,c=[],o=t.isMaterial,p=Array.isArray(t),f=r.groups,u=o?t.side:t,l=this.indirect?an:en;for(let m=0,w=a.length;m<w;m++){let b=p?t[f[m].materialIndex].side:u,y=c.length;if(l(this,m,b,e,c,i,s),p){let x=f[m].materialIndex;for(let d=y,h=c.length;d<h;d++)c[d].face.materialIndex=x}}return c}raycastFirst(e,t=xn,i=0,s=1/0){let a=this._roots,r=this.geometry,c=t.isMaterial,o=Array.isArray(t),p=null,f=r.groups,u=c?t.side:t,l=this.indirect?ln:nn;for(let m=0,w=a.length;m<w;m++){let b=o?t[f[m].materialIndex].side:u,y=l(this,m,b,e,i,s);y!=null&&(p==null||y.distance<p.distance)&&(p=y,o&&(y.face.materialIndex=f[m].materialIndex))}return p}intersectsGeometry(e,t){let i=!1,s=this._roots,a=this.indirect?un:sn;for(let r=0,c=s.length;r<c&&(i=a(this,r,e,t),!i);r++);return i}shapecast(e){let t=q.getPrimitive(),i=this.indirect?tn:We,{boundsTraverseOrder:s,intersectsBounds:a,intersectsRange:r,intersectsTriangle:c}=e;if(r&&c){let u=r;r=(l,m,w,b,y)=>u(l,m,w,b,y)?!0:i(l,m,this,c,w,b,t)}else r||(c?r=(u,l,m,w)=>i(u,l,this,c,m,w,t):r=(u,l,m)=>m);let o=!1,p=0,f=this._roots;for(let u=0,l=f.length;u<l;u++){let m=f[u];if(o=ke(this,u,a,r,s,p),o)break;p+=m.byteLength}return q.releasePrimitive(t),o}bvhcast(e,t,i){let{intersectsRanges:s,intersectsTriangles:a}=i,r=q.getPrimitive(),c=this.geometry.index,o=this.geometry.attributes.position,p=this.indirect?w=>{let b=this.resolveTriangleIndex(w);L(r,b*3,c,o)}:w=>{L(r,w*3,c,o)},f=q.getPrimitive(),u=e.geometry.index,l=e.geometry.attributes.position,m=e.indirect?w=>{let b=e.resolveTriangleIndex(w);L(f,b*3,u,l)}:w=>{L(f,w*3,u,l)};if(a){let w=(b,y,x,d,h,A,T,B)=>{for(let g=x,_=x+d;g<_;g++){m(g),f.a.applyMatrix4(t),f.b.applyMatrix4(t),f.c.applyMatrix4(t),f.needsUpdate=!0;for(let v=b,S=b+y;v<S;v++)if(p(v),r.needsUpdate=!0,a(r,f,v,g,h,A,T,B))return!0}return!1};if(s){let b=s;s=function(y,x,d,h,A,T,B,g){return b(y,x,d,h,A,T,B,g)?!0:w(y,x,d,h,A,T,B,g)}}else s=w}return dn(this,e,t,s)}intersectsBox(e,t){return ee.set(e.min,e.max,t),ee.needsUpdate=!0,this.shapecast({intersectsBounds:i=>ee.intersectsBox(i),intersectsTriangle:i=>ee.intersectsTriangle(i)})}intersectsSphere(e){return this.shapecast({intersectsBounds:t=>e.intersectsBox(t),intersectsTriangle:t=>t.intersectsSphere(e)})}closestPointToGeometry(e,t,i={},s={},a=0,r=1/0){return(this.indirect?pn:on)(this,e,t,i,s,a,r)}closestPointToPoint(e,t={},i=0,s=1/0){return Ge(this,e,t,i,s)}getBoundingBox(e){return e.makeEmpty(),this._roots.forEach(i=>{M(0,new Float32Array(i),yn),e.union(yn)}),e}};var Tn=`

// A stack of uint32 indices can can store the indices for
// a perfectly balanced tree with a depth up to 31. Lower stack
// depth gets higher performance.
//
// However not all trees are balanced. Best value to set this to
// is the trees max depth.
#ifndef BVH_STACK_DEPTH
#define BVH_STACK_DEPTH 60
#endif

#ifndef INFINITY
#define INFINITY 1e20
#endif

// Utilities
uvec4 uTexelFetch1D( usampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

ivec4 iTexelFetch1D( isampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 texelFetch1D( sampler2D tex, uint index ) {

	uint width = uint( textureSize( tex, 0 ).x );
	uvec2 uv;
	uv.x = index % width;
	uv.y = index / width;

	return texelFetch( tex, ivec2( uv ), 0 );

}

vec4 textureSampleBarycoord( sampler2D tex, vec3 barycoord, uvec3 faceIndices ) {

	return
		barycoord.x * texelFetch1D( tex, faceIndices.x ) +
		barycoord.y * texelFetch1D( tex, faceIndices.y ) +
		barycoord.z * texelFetch1D( tex, faceIndices.z );

}

void ndcToCameraRay(
	vec2 coord, mat4 cameraWorld, mat4 invProjectionMatrix,
	out vec3 rayOrigin, out vec3 rayDirection
) {

	// get camera look direction and near plane for camera clipping
	vec4 lookDirection = cameraWorld * vec4( 0.0, 0.0, - 1.0, 0.0 );
	vec4 nearVector = invProjectionMatrix * vec4( 0.0, 0.0, - 1.0, 1.0 );
	float near = abs( nearVector.z / nearVector.w );

	// get the camera direction and position from camera matrices
	vec4 origin = cameraWorld * vec4( 0.0, 0.0, 0.0, 1.0 );
	vec4 direction = invProjectionMatrix * vec4( coord, 0.5, 1.0 );
	direction /= direction.w;
	direction = cameraWorld * direction - origin;

	// slide the origin along the ray until it sits at the near clip plane position
	origin.xyz += direction.xyz * near / dot( direction, lookDirection );

	rayOrigin = origin.xyz;
	rayDirection = direction.xyz;

}
`;var An=`

#ifndef TRI_INTERSECT_EPSILON
#define TRI_INTERSECT_EPSILON 1e-5
#endif

// Raycasting
bool intersectsBounds( vec3 rayOrigin, vec3 rayDirection, vec3 boundsMin, vec3 boundsMax, out float dist ) {

	// https://www.reddit.com/r/opengl/comments/8ntzz5/fast_glsl_ray_box_intersection/
	// https://tavianator.com/2011/ray_box.html
	vec3 invDir = 1.0 / rayDirection;

	// find intersection distances for each plane
	vec3 tMinPlane = invDir * ( boundsMin - rayOrigin );
	vec3 tMaxPlane = invDir * ( boundsMax - rayOrigin );

	// get the min and max distances from each intersection
	vec3 tMinHit = min( tMaxPlane, tMinPlane );
	vec3 tMaxHit = max( tMaxPlane, tMinPlane );

	// get the furthest hit distance
	vec2 t = max( tMinHit.xx, tMinHit.yz );
	float t0 = max( t.x, t.y );

	// get the minimum hit distance
	t = min( tMaxHit.xx, tMaxHit.yz );
	float t1 = min( t.x, t.y );

	// set distance to 0.0 if the ray starts inside the box
	dist = max( t0, 0.0 );

	return t1 >= dist;

}

bool intersectsTriangle(
	vec3 rayOrigin, vec3 rayDirection, vec3 a, vec3 b, vec3 c,
	out vec3 barycoord, out vec3 norm, out float dist, out float side
) {

	// https://stackoverflow.com/questions/42740765/intersection-between-line-and-triangle-in-3d
	vec3 edge1 = b - a;
	vec3 edge2 = c - a;
	norm = cross( edge1, edge2 );

	float det = - dot( rayDirection, norm );
	float invdet = 1.0 / det;

	vec3 AO = rayOrigin - a;
	vec3 DAO = cross( AO, rayDirection );

	vec4 uvt;
	uvt.x = dot( edge2, DAO ) * invdet;
	uvt.y = - dot( edge1, DAO ) * invdet;
	uvt.z = dot( AO, norm ) * invdet;
	uvt.w = 1.0 - uvt.x - uvt.y;

	// set the hit information
	barycoord = uvt.wxy; // arranged in A, B, C order
	dist = uvt.z;
	side = sign( det );
	norm = side * normalize( norm );

	// add an epsilon to avoid misses between triangles
	uvt += vec4( TRI_INTERSECT_EPSILON );

	return all( greaterThanEqual( uvt, vec4( 0.0 ) ) );

}

bool intersectTriangles(
	// geometry info and triangle range
	sampler2D positionAttr, usampler2D indexAttr, uint offset, uint count,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// outputs
	inout float minDistance, inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	bool found = false;
	vec3 localBarycoord, localNormal;
	float localDist, localSide;
	for ( uint i = offset, l = offset + count; i < l; i ++ ) {

		uvec3 indices = uTexelFetch1D( indexAttr, i ).xyz;
		vec3 a = texelFetch1D( positionAttr, indices.x ).rgb;
		vec3 b = texelFetch1D( positionAttr, indices.y ).rgb;
		vec3 c = texelFetch1D( positionAttr, indices.z ).rgb;

		if (
			intersectsTriangle( rayOrigin, rayDirection, a, b, c, localBarycoord, localNormal, localDist, localSide )
			&& localDist < minDistance
		) {

			found = true;
			minDistance = localDist;

			faceIndices = uvec4( indices.xyz, i );
			faceNormal = localNormal;

			side = localSide;
			barycoord = localBarycoord;
			dist = localDist;

		}

	}

	return found;

}

bool intersectsBVHNodeBounds( vec3 rayOrigin, vec3 rayDirection, sampler2D bvhBounds, uint currNodeIndex, out float dist ) {

	uint cni2 = currNodeIndex * 2u;
	vec3 boundsMin = texelFetch1D( bvhBounds, cni2 ).xyz;
	vec3 boundsMax = texelFetch1D( bvhBounds, cni2 + 1u ).xyz;
	return intersectsBounds( rayOrigin, rayDirection, boundsMin, boundsMax, dist );

}

// use a macro to hide the fact that we need to expand the struct into separate fields
#define	bvhIntersectFirstHit(		bvh,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)	_bvhIntersectFirstHit(		bvh.position, bvh.index, bvh.bvhBounds, bvh.bvhContents,		rayOrigin, rayDirection, faceIndices, faceNormal, barycoord, side, dist	)

bool _bvhIntersectFirstHit(
	// bvh info
	sampler2D bvh_position, usampler2D bvh_index, sampler2D bvh_bvhBounds, usampler2D bvh_bvhContents,

	// ray
	vec3 rayOrigin, vec3 rayDirection,

	// output variables split into separate variables due to output precision
	inout uvec4 faceIndices, inout vec3 faceNormal, inout vec3 barycoord,
	inout float side, inout float dist
) {

	// stack needs to be twice as long as the deepest tree we expect because
	// we push both the left and right child onto the stack every traversal
	int ptr = 0;
	uint stack[ BVH_STACK_DEPTH ];
	stack[ 0 ] = 0u;

	float triangleDistance = INFINITY;
	bool found = false;
	while ( ptr > - 1 && ptr < BVH_STACK_DEPTH ) {

		uint currNodeIndex = stack[ ptr ];
		ptr --;

		// check if we intersect the current bounds
		float boundsHitDistance;
		if (
			! intersectsBVHNodeBounds( rayOrigin, rayDirection, bvh_bvhBounds, currNodeIndex, boundsHitDistance )
			|| boundsHitDistance > triangleDistance
		) {

			continue;

		}

		uvec2 boundsInfo = uTexelFetch1D( bvh_bvhContents, currNodeIndex ).xy;
		bool isLeaf = bool( boundsInfo.x & 0xffff0000u );

		if ( isLeaf ) {

			uint count = boundsInfo.x & 0x0000ffffu;
			uint offset = boundsInfo.y;

			found = intersectTriangles(
				bvh_position, bvh_index, offset, count,
				rayOrigin, rayDirection, triangleDistance,
				faceIndices, faceNormal, barycoord, side, dist
			) || found;

		} else {

			uint leftIndex = currNodeIndex + 1u;
			uint splitAxis = boundsInfo.x & 0x0000ffffu;
			uint rightIndex = boundsInfo.y;

			bool leftToRight = rayDirection[ splitAxis ] >= 0.0;
			uint c1 = leftToRight ? leftIndex : rightIndex;
			uint c2 = leftToRight ? rightIndex : leftIndex;

			// set c2 in the stack so we traverse it later. We need to keep track of a pointer in
			// the stack while we traverse. The second pointer added is the one that will be
			// traversed first
			ptr ++;
			stack[ ptr ] = c2;

			ptr ++;
			stack[ ptr ] = c1;

		}

	}

	return found;

}
`;var eo=`
	${Tn}
	${An}
`;export{ne as MeshBVH};

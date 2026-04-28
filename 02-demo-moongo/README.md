# MongoDB Demo on Kubernetes

นี่คือการตั้งค่าระบบ MongoDB บนคลัสเตอร์ Kubernetes ที่สมบูรณ์ โดยใช้ Persistent Storage และ NodePort Service

## 📋 ลำดับการทำงาน

ไฟล์ต่อไปนี้ควรติดตั้งตามลำดับของตัวเลข:

1. **00-mongodb-namespace.yaml** - สร้าง Namespace
2. **01-mongodb-secrets.yaml** - สร้าง Secret สำหรับ credentials
3. **02-mongodb-pv.yaml** - สร้าง Persistent Volume (PV)
4. **03-mongodb-pvc.yaml** - สร้าง Persistent Volume Claim (PVC)
5. **04-mongodb-deployment.yaml** - ติดตั้ง MongoDB Deployment
6. **05-mongodb-modeport-svc.yaml** - สร้าง NodePort Service
7. **06-mongodb-client.yaml** - ติดตั้ง MongoDB Client สำหรับทดสอบ

---

## 📁 รายละเอียดไฟล์แต่ละอัน

### 1️⃣ 00-mongodb-namespace.yaml
**วัตถุประสงค์:** สร้าง Kubernetes Namespace ชื่อ `demomongo`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: demomongo
```

**อธิบาย:**
- `Namespace` คือการจัดกลุ่มวัตถุ Kubernetes ในแต่ละขอบเขต
- ช่วยแยกแยะระบบและทรัพยากรต่างๆ
- ป้องกันการชนของชื่อระหว่าง projects ต่างๆ

---

### 2️⃣ 01-mongodb-secrets.yaml
**วัตถุประสงค์:** เก็บ credentials ที่ละเอียดอ่อน (username, password)

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: mongodb-secrets
  namespace: demomongo
data:
  username: YWRtaW51c2Vy       # adminuser (base64)
  password: cGFzc3dvcmQxMjM=   # password123 (base64)
```

**อธิบาย:**
- `Secret` ใช้เก็บข้อมูลที่ปกป้องเช่น passwords, tokens, keys
- ข้อมูลถูก encode เป็น base64 (ไม่ใช่การเข้ารหัส)
- Deployment สามารถอ่าน Secret และใช้ในตัวแปรสภาพแวดล้อม
- Username: `adminuser`, Password: `password123`

---

### 3️⃣ 02-mongodb-pv.yaml
**วัตถุประสงค์:** สร้าง Persistent Volume (PV) สำหรับเก็บข้อมูล MongoDB

```yaml
apiVersion: v1
kind: PersistentVolume
metadata:
  name: mongo-data-pv
  namespace: demomongo
spec:
  capacity:
    storage: 1Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: ""
  hostPath:
    path: /data/mongo
```

**อธิบาย:**
- **Capacity**: ขนาด storage = 1 GB
- **AccessMode - ReadWriteOnce**: เฉพาะ 1 Pod สามารถ read/write ได้พร้อมกัน
- **Reclaim Policy - Retain**: เมื่อ PVC ลบ ข้อมูล PV จะยังเหลืออยู่
- **hostPath**: บันทึกข้อมูลที่ `/data/mongo` บน Node

---

### 4️⃣ 03-mongodb-pvc.yaml
**วัตถุประสงค์:** สร้าง Persistent Volume Claim (PVC) เพื่อใช้ PV

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongo-data-pvc
  namespace: demomongo
spec:
  storageClassName: ""
  accessModes:
    - ReadWriteOnce
  volumeName: mongo-data-pv
  resources:
    requests:
      storage: 1Gi
```

**อธิบาย:**
- **PVC** คือการร้องขอเพื่อใช้ PV จาก user/Pod
- **volumeName**: ระบุว่าต้องการใช้ PV ชื่อ `mongo-data-pv`
- **Storage Request**: ขออนุญาต 1 GB จาก PV
- Pod สามารถติดต่อ PVC นี้เพื่อเข้าถึง storage

---

### 5️⃣ 04-mongodb-deployment.yaml
**วัตถุประสงค์:** ติดตั้ง MongoDB Pod ด้วย Deployment

**ส่วนหลัก:**

| ส่วน | คำอธิบาย |
|------|----------|
| **Image** | `mongo` (Official MongoDB image) |
| **Replicas** | 1 (มี 1 Pod เท่านั้น) |
| **Port** | 27017 (default MongoDB port) |
| **Data Path** | `/data/db` (mount PVC ที่นี่) |

**Probes:**
- **Liveness Probe**: ตรวจสอบว่า MongoDB ยังมีชีวิต ถ้าไม่ตอบสนองจะ restart
- **Readiness Probe**: ตรวจสอบว่า MongoDB พร้อมรับ connection

**Environment Variables:**
- `MONGO_INITDB_ROOT_USERNAME`: มาจาก Secret
- `MONGO_INITDB_ROOT_PASSWORD`: มาจาก Secret

**Volume Mount:**
- เชื่อมต่อ PVC ที่ `/data/db` ใน container

---

### 6️⃣ 05-mongodb-modeport-svc.yaml
**วัตถุประสงค์:** สร้าง NodePort Service เพื่อเข้าถึง MongoDB จากภายนอก

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongo-nodeport-svc
  namespace: demomongo
spec:
  type: NodePort
  ports:
    - port: 27017          # Service port (internal)
      protocol: TCP
      targetPort: 27017    # Container port
      nodePort: 32000      # Node port (exposed to outside)
  selector:
    app: mongo
```

**อธิบาย:**
- **Service Type: NodePort** - เปิดให้เข้าถึง MongoDB จากภายนอก cluster
- **Port 27017**: ใช้ภายใน cluster
- **NodePort 32000**: ใช้เข้าถึงจากภายนอก (30000-32767)
- **Selector**: เลือก Pod ที่มี label `app: mongo`

**การเข้าถึง:**
```bash
# จากภายนอก cluster
mongo mongodb://adminuser:password123@<NODE_IP>:32000

# จากภายใน cluster
mongo mongodb://adminuser:password123@mongo-nodeport-svc:27017
```

---

### 7️⃣ 06-mongodb-client.yaml
**วัตถุประสงค์:** ติดตั้ง MongoDB Client Pod สำหรับทดสอบ

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongo-client
  namespace: demomongo
spec:
  replicas: 1
  containers:
    - image: mongo:4.4-bionic
      name: mongo-client
```

**อธิบาย:**
- ใช้ MongoDB image 4.4 เป็น client
- สามารถใช้ `mongosh` หรือ `mongo` shell เพื่อเชื่อมต่อกับ MongoDB
- เหมาะสำหรับทดสอบการเชื่อมต่อ

**วิธีการใช้:**
```bash
# เข้า Pod
kubectl -n demomongo exec -it <mongo-client-pod-name> -- bash

# เชื่อมต่อ MongoDB
mongosh mongodb://adminuser:password123@mongo-nodeport-svc:27017
```

---

## 🚀 วิธีการติดตั้ง

### 1. ติดตั้งทั้งหมดพร้อมกัน
```bash
cd /Users/mac/Desktop/k8s/02-demo-moongo
kubectl apply -f .
```

### 2. หรือติดตั้งทีละไฟล์ตามลำดับ
```bash
kubectl apply -f 00-mongodb-namespace.yaml
kubectl apply -f 01-mongodb-secrets.yaml
kubectl apply -f 02-mongodb-pv.yaml
kubectl apply -f 03-mongodb-pvc.yaml
kubectl apply -f 04-mongodb-deployment.yaml
kubectl apply -f 05-mongodb-modeport-svc.yaml
kubectl apply -f 06-mongodb-client.yaml
```

---

## 📊 ตรวจสอบสถานะ

```bash
# ตรวจสอบ Namespace
kubectl get namespace demomongo

# ตรวจสอบ Secrets
kubectl -n demomongo get secrets

# ตรวจสอบ Persistent Volumes
kubectl get pv
kubectl -n demomongo get pvc

# ตรวจสอบ Deployments
kubectl -n demomongo get deployments
kubectl -n demomongo get pods

# ตรวจสอบ Services
kubectl -n demomongo get svc

# ดูรายละเอียด Pod
kubectl -n demomongo describe pod <pod-name>

# ดูเรียง logs
kubectl -n demomongo logs <pod-name>
```

---

## 🔑 Credentials

| ชื่อ | ค่า |
|------|-------|
| Username | `adminuser` |
| Password | `password123` |
| Namespace | `demomongo` |
| Service | `mongo-nodeport-svc` |
| NodePort | `32000` |
| MongoDB Port | `27017` |

---

## 🗑️ การลบ

```bash
# ลบทั้งหมด
kubectl delete namespace demomongo

# หรือลบทีละอัน
kubectl delete -f .
```

---

## 📝 หมายเหตุ

- ข้อมูล MongoDB ถูกเก็บไว้ที่ `/data/mongo` บน Node ด้วย hostPath
- ใน production ควรใช้ storage class ที่เหมาะสมแทน hostPath
- Credentials ในไฟล์นี้ใช้เพื่อทดสอบเท่านั้น ใน production ต้องการ stronger security
- MongoDB replicas ตั้งไว้ = 1 สำหรับ demo ใน production ควรมี 3+ replicas

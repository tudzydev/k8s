import http from 'k6/http'
import { sleep } from 'k6'

export const options = {
  stages: [
    { duration: '10s', target: 20 }, // เพิ่มผู้ใช้จำลองขึ้นถึง 20 คนภายใน 10 วินาที
    { duration: '30s', target: 20 }, // คงโหลดไว้ 20 คน
    { duration: '10s', target: 0 },  // ลดลงเหลือ 0
  ],
}

export default function () {
  http.get('http://10.101.196.252:30081')
  sleep(1)
}
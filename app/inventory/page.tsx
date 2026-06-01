import React from 'react'
import CreateForm from "@/components/adventures/form/form";
import style from '@/styles/pages/inventory.module.css';

const page = () => {
  return (
    <div className={style.container}>
      <CreateForm />
    </div>
  )
}

export default page
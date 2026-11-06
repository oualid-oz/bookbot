import Image from "next/image"
import Link from "next/link"

import logo from "../../public/icon-192.png"
import { Button } from "@/components/ui/button"

/** The body of a 404 page; the links are for signed-in users, as the proxy sends everyone else to login */
export function NotFoundMessage({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-5 text-center">
      <Image src={logo} alt="" width={72} height={72} className="size-18 rounded-2xl" unoptimized priority />
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">404</p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-md text-muted-foreground">{description}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href="/home">Go to Home</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/projects">View projects</Link>
        </Button>
      </div>
    </div>
  )
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "세특 스튜디오", description: "학생 활동 키워드로 만드는 과목별 세부능력 및 특기사항 초안" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}

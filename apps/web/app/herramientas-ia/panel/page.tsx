import { AiTools } from '@/components/AiTools';
import type { Metadata } from 'next';

export const metadata: Metadata = {title:'Panel de herramientas IA',robots:{index:false,follow:false}};

export default function AiPanelPage() {
  return <AiTools/>;
}

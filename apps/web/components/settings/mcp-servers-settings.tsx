'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/common/button';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/common/modal';
import { Loading } from '@/components/common/loading';
import { useToast } from '@/components/common/toast';
import { listMCPServers, deleteMCPServer, testMCPServer } from '@/lib/api/mcp';
import type { MCPServer } from '@/lib/api/mcp';

export function MCPServersSettings() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const { showToast } = useToast();

  const loadServers = async () => {
    try {
      const response = await listMCPServers();
      setServers(response.servers);
    } catch (error) {
      showToast('فشل تحميل الخوادم', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  const handleTest = async (serverId: string) => {
    try {
      const result = await testMCPServer(serverId);
      showToast(result.success ? 'الاتصال ناجح' : 'فشل الاتصال', result.success ? 'success' : 'error');
    } catch (error) {
      showToast('فشل اختبار الخادم', 'error');
    }
  };

  const handleDelete = async (serverId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الخادم؟')) return;
    try {
      await deleteMCPServer(serverId);
      showToast('تم الحذف بنجاح', 'success');
      loadServers();
    } catch (error) {
      showToast('فشل الحذف', 'error');
    }
  };

  if (loading) return <Loading message="جاري تحميل الخوادم..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-text">خوادم MCP</h3>
        <Button onClick={() => setModalOpen(true)}>إضافة خادم</Button>
      </div>

      {servers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔌</div>
          <div className="empty-state-title">لا توجد خوادم MCP</div>
          <div className="empty-state-desc">أضف خادم MCP للبدء</div>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <div key={server.id} className="mcp-card">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mcp-card-name">{server.name}</div>
                  <div className="mcp-card-transport">{server.transport}</div>
                  {server.endpoint && <div className="mcp-card-endpoint">{server.endpoint}</div>}
                  {server.command && <div className="mcp-card-endpoint">{server.command}</div>}
                </div>
                <span className={`text-xs px-2 py-1 rounded ${server.enabled ? 'bg-success/20 text-success' : 'bg-muted/20 text-muted'}`}>
                  {server.enabled ? 'مفعل' : 'معطل'}
                </span>
              </div>
              <div className="mcp-card-footer">
                <span className="text-xs text-muted">{server.tools_count || 0} أدوات</span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => handleTest(server.id)}>اختبار</Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(server.id)}>حذف</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)}>
        <ModalHeader onClose={() => setModalOpen(false)}>إضافة خادم MCP</ModalHeader>
        <ModalBody>
          <div className="text-center text-muted">قريباً - استمارة إضافة خادم MCP</div>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setModalOpen(false)}>إلغاء</Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, RefreshControl, Modal, TextInput } from 'react-native';
import { 
  ArrowLeft, Filter, Search, MapPin, Clock, CircleCheck as CheckCircle, 
  TriangleAlert as AlertTriangle, FileText, Hammer, Send, X, User
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { 
  getIssuesByWorkflowStage, 
  createTender,
  assignTenderToContractor,
  getCurrentUser,
  getUserProfile
} from '../../lib/supabase';

export default function DepartmentAdminIssues() {
  const router = useRouter();
  const [issues, setIssues] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('department_assigned');
  const [showTenderModal, setShowTenderModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [tenderData, setTenderData] = useState({
    title: '',
    description: '',
    estimatedBudgetMin: '',
    estimatedBudgetMax: '',
    deadlineDate: '',
    requirements: ''
  });
  const [creating, setCreating] = useState(false);
  const [userDepartmentId, setUserDepartmentId] = useState(null);

  const filters = [
    { id: 'department_assigned', label: 'Assigned to Department', color: '#8B5CF6' },
    { id: 'contractor_assigned', label: 'With Contractors', color: '#06B6D4' },
    { id: 'in_progress', label: 'In Progress', color: '#1E40AF' },
    { id: 'department_review', label: 'Pending Review', color: '#F59E0B' },
    { id: 'resolved', label: 'Completed', color: '#10B981' },
  ];

  useEffect(() => {
    loadData();
  }, [selectedFilter]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Get current user's department
      const { user } = await getCurrentUser();
      const { data: profile } = await getUserProfile(user.id);
      setUserDepartmentId(profile?.assigned_department_id);

      // Load issues by workflow stage for this department
      const { data: issuesData, error: issuesError } = await getIssuesByWorkflowStage(
        selectedFilter, 
        null, // areaId
        profile?.assigned_department_id
      );
      if (issuesError) throw issuesError;

      setIssues(issuesData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load issues data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleCreateTender = (issue) => {
    setSelectedIssue(issue);
    setTenderData({
      title: `Tender for: ${issue.title}`,
      description: `${issue.description}\n\nLocation: ${issue.location_name || issue.address}`,
      estimatedBudgetMin: '',
      estimatedBudgetMax: '',
      deadlineDate: '',
      requirements: ''
    });
    setShowTenderModal(true);
  };

  const submitTender = async () => {
    if (!tenderData.title || !tenderData.description || !tenderData.deadlineDate) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setCreating(true);

      const tender = {
        title: tenderData.title,
        description: tenderData.description,
        category: selectedIssue.category,
        location: selectedIssue.location_name || selectedIssue.address,
        area: selectedIssue.area,
        ward: selectedIssue.ward,
        estimated_budget_min: parseFloat(tenderData.estimatedBudgetMin) || 0,
        estimated_budget_max: parseFloat(tenderData.estimatedBudgetMax) || 0,
        deadline_date: tenderData.deadlineDate,
        submission_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        priority: selectedIssue.priority,
        requirements: tenderData.requirements.split('\n').filter(r => r.trim()),
        status: 'available',
        source_issue_id: selectedIssue.id,
        department_id: userDepartmentId,
        metadata: {
          source_issue_id: selectedIssue.id,
          created_by_department: userDepartmentId
        }
      };

      const { error } = await createTender(tender);
      if (error) throw error;

      // Update issue workflow stage
      const { error: updateError } = await updateIssue(selectedIssue.id, {
        workflow_stage: 'contractor_assigned',
        status: 'in_progress'
      });

      if (updateError) console.error('Error updating issue workflow:', updateError);

      Alert.alert(
        'Success',
        'Tender has been created successfully and is now available for contractors to bid',
        [
          {
            text: 'OK',
            onPress: () => {
              setShowTenderModal(false);
              setSelectedIssue(null);
              loadData();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error creating tender:', error);
      Alert.alert('Error', 'Failed to create tender: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#F59E0B',
      acknowledged: '#3B82F6',
      in_progress: '#1E40AF',
      resolved: '#10B981',
    };
    return colors[status] || '#6B7280';
  };

  const getCategoryColor = (category) => {
    const colors = {
      roads: '#EF4444',
      utilities: '#F59E0B',
      environment: '#10B981',
      safety: '#8B5CF6',
      parks: '#06B6D4',
    };
    return colors[category] || '#6B7280';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Department Issues</Text>
          <Text style={styles.subtitle}>{issues.length} issues in current view</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <Search size={20} color="#1E40AF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton}>
            <Filter size={20} color="#1E40AF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filtersList}>
            {filters.map((filter) => {
              const count = issues.filter(i => i.workflow_stage === filter.id).length;
              return (
                <TouchableOpacity
                  key={filter.id}
                  style={[
                    styles.filterChip,
                    selectedFilter === filter.id && styles.filterChipActive,
                    { borderColor: filter.color }
                  ]}
                  onPress={() => setSelectedFilter(filter.id)}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      selectedFilter === filter.id && { color: filter.color }
                    ]}
                  >
                    {filter.label}
                  </Text>
                  <View style={styles.filterChipBadge}>
                    <Text style={styles.filterChipBadgeText}>{count}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Issues List */}
      <ScrollView
        style={styles.issuesList}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading issues...</Text>
          </View>
        ) : issues.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AlertTriangle size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>No issues found</Text>
            <Text style={styles.emptyText}>
              No issues in {filters.find(f => f.id === selectedFilter)?.label.toLowerCase()} stage
            </Text>
          </View>
        ) : (
          <View style={styles.issuesContainer}>
            {issues.map((issue) => (
              <View key={issue.id} style={styles.issueCard}>
                {/* Issue Header */}
                <View style={styles.issueHeader}>
                  <View style={styles.issueMeta}>
                    <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(issue.category) + '20' }]}>
                      <Text style={[styles.categoryText, { color: getCategoryColor(issue.category) }]}>
                        {issue.category.charAt(0).toUpperCase() + issue.category.slice(1)}
                      </Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: getStatusColor(issue.priority) }]}>
                      <Text style={styles.priorityText}>
                        {issue.priority.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusContainer}>
                    <Text style={[styles.statusText, { color: getStatusColor(issue.status) }]}>
                      {issue.status.replace('_', ' ').charAt(0).toUpperCase() + issue.status.replace('_', ' ').slice(1)}
                    </Text>
                  </View>
                </View>

                {/* Issue Content */}
                <Text style={styles.issueTitle}>{issue.title}</Text>
                <Text style={styles.issueDescription} numberOfLines={3}>
                  {issue.description}
                </Text>

                {/* Reporter Info */}
                <View style={styles.reporterInfo}>
                  <User size={14} color="#6B7280" />
                  <Text style={styles.reporterText}>
                    Reported by {issue.profiles?.full_name || 'Anonymous'}
                  </Text>
                  <Text style={styles.reportDate}>{formatDate(issue.created_at)}</Text>
                </View>

                {/* Location */}
                {issue.location_name && (
                  <View style={styles.locationContainer}>
                    <MapPin size={14} color="#6B7280" />
                    <Text style={styles.locationText}>{issue.location_name}</Text>
                  </View>
                )}

                {/* Assignment History */}
                {issue.assignments && issue.assignments.length > 0 && (
                  <View style={styles.assignmentHistory}>
                    <Text style={styles.assignmentHistoryTitle}>Assignment History:</Text>
                    {issue.assignments.slice(0, 2).map((assignment, index) => (
                      <Text key={index} style={styles.assignmentHistoryText}>
                        • Assigned by {assignment.assigned_by_profile?.full_name} on {formatDate(assignment.created_at)}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Actions */}
                <View style={styles.issueActions}>
                  {issue.workflow_stage === 'department_assigned' && (
                    <TouchableOpacity
                      style={styles.tenderButton}
                      onPress={() => handleCreateTender(issue)}
                    >
                      <FileText size={16} color="#FFFFFF" />
                      <Text style={styles.tenderButtonText}>Create Tender</Text>
                    </TouchableOpacity>
                  )}
                  
                  <TouchableOpacity
                    style={styles.viewButton}
                    onPress={() => router.push(`/department-admin/issue-${issue.id}`)}
                  >
                    <Text style={styles.viewButtonText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Create Tender Modal */}
      <Modal visible={showTenderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Tender</Text>
              <TouchableOpacity onPress={() => setShowTenderModal(false)}>
                <X size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Tender Title *</Text>
                <TextInput
                  style={styles.textInput}
                  value={tenderData.title}
                  onChangeText={(text) => setTenderData({...tenderData, title: text})}
                  placeholder="Enter tender title"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={tenderData.description}
                  onChangeText={(text) => setTenderData({...tenderData, description: text})}
                  placeholder="Detailed tender description"
                  multiline
                  numberOfLines={4}
                />
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputGroupHalf}>
                  <Text style={styles.inputLabel}>Min Budget ($)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tenderData.estimatedBudgetMin}
                    onChangeText={(text) => setTenderData({...tenderData, estimatedBudgetMin: text})}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.inputGroupHalf}>
                  <Text style={styles.inputLabel}>Max Budget ($)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={tenderData.estimatedBudgetMax}
                    onChangeText={(text) => setTenderData({...tenderData, estimatedBudgetMax: text})}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Deadline Date *</Text>
                <TextInput
                  style={styles.textInput}
                  value={tenderData.deadlineDate}
                  onChangeText={(text) => setTenderData({...tenderData, deadlineDate: text})}
                  placeholder="YYYY-MM-DD"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Requirements</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={tenderData.requirements}
                  onChangeText={(text) => setTenderData({...tenderData, requirements: text})}
                  placeholder="List requirements (one per line)"
                  multiline
                  numberOfLines={3}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowTenderModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitButton, creating && styles.modalSubmitButtonDisabled]}
                onPress={submitTender}
                disabled={creating}
              >
                <Send size={16} color="#FFFFFF" />
                <Text style={styles.modalSubmitText}>
                  {creating ? 'Creating...' : 'Create Tender'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F0F9FF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    backgroundColor: '#F0F9FF',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  filtersSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    marginBottom: 8,
  },
  filtersList: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#F0F9FF',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterChipBadge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    minWidth: 16,
    alignItems: 'center',
  },
  filterChipBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
  },
  issuesList: {
    flex: 1,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  issuesContainer: {
    padding: 16,
    gap: 16,
  },
  issueCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  issueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  issueMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  issueTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  issueDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  reporterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  reporterText: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  reportDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  locationText: {
    fontSize: 12,
    color: '#6B7280',
  },
  assignmentHistory: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  assignmentHistoryTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  assignmentHistoryText: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 2,
  },
  issueActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  tenderButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tenderButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  viewButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  viewButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  modalForm: {
    flex: 1,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  inputGroupHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F59E0B',
    gap: 6,
  },
  modalSubmitButtonDisabled: {
    opacity: 0.6,
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
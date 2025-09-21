import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Hammer, Clock, CircleCheck as CheckCircle, MapPin, FileText, TrendingUp, Calendar, DollarSign, User, Building, Activity } from 'lucide-react-native';
import { 
  getContractorDashboard, 
  getWorkProgress, 
  getCurrentUser,
  getUserProfile
} from '../lib/supabase';
import WorkProgressTracker from '../components/WorkProgressTracker';

export default function ContractorWorkScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [assignedWork, setAssignedWork] = useState([]);
  const [workProgress, setWorkProgress] = useState([]);
  const [showProgressTracker, setShowProgressTracker] = useState(false);
  const [selectedWorkItem, setSelectedWorkItem] = useState(null);
  const [stats, setStats] = useState({
    activeProjects: 0,
    completedProjects: 0,
    totalEarnings: 0,
    avgRating: 0
  });

  useEffect(() => {
    checkContractorAccess();
  }, []);

  const checkContractorAccess = async () => {
    try {
      const { user: currentUser, error: userError } = await getCurrentUser();
      if (userError || !currentUser) {
        Alert.alert('Access Denied', 'Please sign in to access contractor work');
        router.replace('/auth');
        return;
      }

      const { data: profileData, error: profileError } = await getUserProfile(currentUser.id);
      if (profileError || !profileData || profileData.user_type !== 'tender') {
        Alert.alert('Access Denied', 'You do not have contractor privileges');
        router.replace('/(tabs)');
        return;
      }

      setUser(currentUser);
      await loadWorkData();
    } catch (error) {
      console.error('Error checking contractor access:', error);
      router.replace('/auth');
    }
  };

  const loadWorkData = async () => {
    try {
      setLoading(true);

      // Get contractor dashboard data
      const { data: dashboardData, error: dashboardError } = await getContractorDashboard();
      if (dashboardError) throw dashboardError;

      setAssignedWork(dashboardData.assignedWork || []);

      // Get work progress for this contractor
      const { data: progressData, error: progressError } = await getWorkProgress(user?.id);
      if (progressError) throw progressError;

      setWorkProgress(progressData || []);

      // Calculate stats
      const activeProjects = dashboardData.assignedWork?.filter(w => w.status === 'awarded').length || 0;
      const completedProjects = dashboardData.assignedWork?.filter(w => w.status === 'completed').length || 0;
      const totalEarnings = dashboardData.assignedWork?.reduce((sum, work) => sum + (work.awarded_amount || 0), 0) || 0;

      setStats({
        activeProjects,
        completedProjects,
        totalEarnings,
        avgRating: 4.2 // Placeholder
      });

    } catch (error) {
      console.error('Error loading work data:', error);
      Alert.alert('Error', 'Failed to load work data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWorkData();
    setRefreshing(false);
  };

  const handleTrackProgress = (workItem) => {
    setSelectedWorkItem(workItem);
    setShowProgressTracker(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'awarded': return '#1E40AF';
      case 'in_progress': return '#F59E0B';
      case 'completed': return '#10B981';
      case 'on_hold': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Activity size={32} color="#1E40AF" />
        <Text style={styles.loadingText}>Loading contractor work...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#1E40AF" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>My Work</Text>
          <Text style={styles.subtitle}>Manage assigned projects and track progress</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Overview */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Work Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Hammer size={20} color="#1E40AF" />
              <Text style={styles.statNumber}>{stats.activeProjects}</Text>
              <Text style={styles.statLabel}>Active Projects</Text>
            </View>
            <View style={styles.statCard}>
              <CheckCircle size={20} color="#10B981" />
              <Text style={styles.statNumber}>{stats.completedProjects}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statCard}>
              <DollarSign size={20} color="#F59E0B" />
              <Text style={styles.statNumber}>{formatCurrency(stats.totalEarnings)}</Text>
              <Text style={styles.statLabel}>Total Earnings</Text>
            </View>
            <View style={styles.statCard}>
              <TrendingUp size={20} color="#8B5CF6" />
              <Text style={styles.statNumber}>{stats.avgRating}/5</Text>
              <Text style={styles.statLabel}>Avg Rating</Text>
            </View>
          </View>
        </View>

        {/* Assigned Work */}
        <View style={styles.workSection}>
          <Text style={styles.sectionTitle}>Assigned Projects ({assignedWork.length})</Text>
          <View style={styles.workList}>
            {assignedWork.map((work) => (
              <View key={work.id} style={styles.workCard}>
                {/* Work Header */}
                <View style={styles.workHeader}>
                  <View style={styles.workMeta}>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(work.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(work.status) }]}>
                        {work.status.charAt(0).toUpperCase() + work.status.slice(1)}
                      </Text>
                    </View>
                    <Text style={styles.workDate}>Awarded {formatDate(work.awarded_at)}</Text>
                  </View>
                  <Text style={styles.workAmount}>{formatCurrency(work.awarded_amount)}</Text>
                </View>

                {/* Work Content */}
                <Text style={styles.workTitle}>{work.title}</Text>
                <Text style={styles.workDescription} numberOfLines={2}>
                  {work.description}
                </Text>

                {/* Source Issue Info */}
                {work.source_issue && (
                  <View style={styles.sourceIssueInfo}>
                    <TriangleAlert size={14} color="#F59E0B" />
                    <Text style={styles.sourceIssueText}>
                      Related Issue: {work.source_issue.title}
                    </Text>
                  </View>
                )}

                {/* Department Info */}
                {work.department && (
                  <View style={styles.departmentInfo}>
                    <Building size={14} color="#8B5CF6" />
                    <Text style={styles.departmentText}>
                      Department: {work.department.name}
                    </Text>
                  </View>
                )}

                {/* Work Details */}
                <View style={styles.workDetails}>
                  <View style={styles.detailRow}>
                    <MapPin size={14} color="#6B7280" />
                    <Text style={styles.detailText}>
                      Location: {work.source_issue?.location_name || work.location || 'Not specified'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Calendar size={14} color="#F59E0B" />
                    <Text style={styles.detailText}>
                      Deadline: {formatDate(work.deadline_date)}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.workActions}>
                  <TouchableOpacity
                    style={styles.progressButton}
                    onPress={() => handleTrackProgress(work)}
                  >
                    <Activity size={16} color="#FFFFFF" />
                    <Text style={styles.progressButtonText}>Track Progress</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.detailsButton}>
                    <Text style={styles.detailsButtonText}>View Details</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {assignedWork.length === 0 && (
              <View style={styles.emptyState}>
                <Hammer size={48} color="#9CA3AF" />
                <Text style={styles.emptyTitle}>No assigned work</Text>
                <Text style={styles.emptyText}>
                  You don't have any assigned projects yet. Check available tenders to submit bids.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Recent Progress Updates */}
        {workProgress.length > 0 && (
          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Recent Progress Updates</Text>
            <View style={styles.progressList}>
              {workProgress.slice(0, 5).map((progress) => (
                <View key={progress.id} style={styles.progressCard}>
                  <View style={styles.progressHeader}>
                    <Text style={styles.progressTitle}>{progress.title}</Text>
                    <Text style={styles.progressPercentage}>{progress.progress_percentage}%</Text>
                  </View>
                  <Text style={styles.progressDescription} numberOfLines={2}>
                    {progress.description}
                  </Text>
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressDate}>{formatDate(progress.created_at)}</Text>
                    <View style={[styles.progressStatus, { backgroundColor: getStatusColor(progress.status) + '20' }]}>
                      <Text style={[styles.progressStatusText, { color: getStatusColor(progress.status) }]}>
                        {progress.status.replace('_', ' ').charAt(0).toUpperCase() + progress.status.replace('_', ' ').slice(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Work Progress Tracker Modal */}
      <WorkProgressTracker
        visible={showProgressTracker}
        onClose={() => {
          setShowProgressTracker(false);
          setSelectedWorkItem(null);
          loadWorkData(); // Refresh data after progress update
        }}
        issueId={selectedWorkItem?.source_issue?.id}
        tenderId={selectedWorkItem?.id}
        contractorId={user?.id}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
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
  content: {
    flex: 1,
  },
  statsSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },
  workSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 8,
  },
  workList: {
    gap: 16,
  },
  workCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  workHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  workMeta: {
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  workDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  workAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
  },
  workTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  workDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 12,
  },
  sourceIssueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 8,
  },
  sourceIssueText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '500',
  },
  departmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 12,
  },
  departmentText: {
    fontSize: 12,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  workDetails: {
    gap: 6,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  workActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  progressButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E40AF',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  progressButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  detailsButton: {
    backgroundColor: '#E5E7EB',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  detailsButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  progressSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 20,
  },
  progressList: {
    gap: 12,
  },
  progressCard: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
    color: '#10B981',
  },
  progressDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  progressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  progressStatus: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  progressStatusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
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
    lineHeight: 20,
  },
});